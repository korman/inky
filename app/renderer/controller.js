const ipc = require("electron").ipcRenderer;
const path = require("path");

const $ = window.jQuery = require('./jquery-2.2.3.min.js');

const EditorView = require("./editorView.js").EditorView;
const PlayerView = require("./playerView.js").PlayerView;
const ToolbarView = require("./toolbarView.js").ToolbarView;
const NavView = require("./navView.js").NavView;
const LiveCompiler = require("./liveCompiler.js").LiveCompiler;
const InkProject = require("./inkProject.js").InkProject;
const NavHistory = require("./navHistory.js").NavHistory;

InkProject.setEvents({
    "newProject": (project) => {
        EditorView.focus();
        LiveCompiler.setProject(project);

        var filename = project.activeInkFile.filename();
        ToolbarView.setTitle(filename);
        NavView.setMainInkFilename(filename);
        NavHistory.reset();
    },
    "didSave": () => {
        var activeInk = InkProject.currentProject.activeInkFile;
        ToolbarView.setTitle(activeInk.filename());
        NavView.setMainInkFilename(InkProject.currentProject.mainInk.filename());
        NavView.highlightRelativePath(activeInk.relativePath());
    },
    "changeOpenInkFile": (inkFile) => {
        ToolbarView.setTitle(inkFile.filename());
        NavView.highlightRelativePath(inkFile.relativePath());
        var fileIssues = LiveCompiler.getIssuesForFilename(inkFile.relativePath());
        setImmediate(() => EditorView.setErrors(fileIssues));
        NavHistory.addStep();
    }
});

// Wait for DOM to be ready before kicking most stuff off
// (some of the views get confused otherwise)
$(document).ready(() => { 
    if( InkProject.currentProject == null ) 
        InkProject.startNew(); 
});

function gotoIssue(issue) {
    InkProject.currentProject.openInkFile(issue.filename);
    EditorView.gotoLine(issue.lineNumber);
    NavHistory.addStep();
}

NavHistory.setEvents({
    goto: (location) => {
        InkProject.currentProject.openInkFile(location.filePath);
        EditorView.gotoLine(location.position.row+1);
    }
})

LiveCompiler.setEvents({
    resetting: () => {
        EditorView.clearErrors();
        ToolbarView.clearIssueSummary();
        PlayerView.prepareForNextContent();
    },
    selectIssue: gotoIssue,
    textAdded: (text, replaying) => {
        var animated = !replaying;
        PlayerView.addTextSection(text, animated);
    },
    choiceAdded: (choice, replaying) => {
        var animated = !replaying;
        if( !replaying ) {
            PlayerView.addChoice(choice, animated, () => {
                LiveCompiler.choose(choice);
            });
        }
    },
    errorAdded: (error) => {

        if( error.filename == InkProject.currentProject.activeInkFile.relativePath() )
            EditorView.addError(error);

        if( error.type == "RUNTIME ERROR" ) {
            PlayerView.addLineError(error, () => gotoIssue(error));
        }
        ToolbarView.updateIssueSummary(LiveCompiler.getIssues());
    },
    playerPrompt: (replaying, isLast) => {
        if( replaying )
            PlayerView.addHorizontalDivider();
        else
            PlayerView.scrollToBottom();
    },
    storyCompleted: () => {
        PlayerView.addTerminatingMessage("End of story", "end");
    },
    unexpectedExit: () => {
        PlayerView.addTerminatingMessage("Story exited unexpectedly", "error");
    }
});

EditorView.setEvents({
    "change": () => {
        LiveCompiler.setEdited();
    },
    "jumpToSymbol": (symbolName, contextPos) => {
        var foundSymbol = InkProject.currentProject.findSymbol(symbolName, contextPos);
        if( foundSymbol ) {
            InkProject.currentProject.openInkFile(foundSymbol.inkFile);
            EditorView.gotoLine(foundSymbol.row+1, foundSymbol.column);
            NavHistory.addStep();
        }
    },
    "jumpToInclude": (includePath) => {
        InkProject.currentProject.openInkFile(includePath);
        NavHistory.addStep();
    },
    "navigate": () => NavHistory.addStep()
});

ToolbarView.setEvents({
    toggleSidebar: () => { NavView.toggle(); },
    navigateBack: () => NavHistory.back(),
    navigateForward: () => NavHistory.forward(),
    selectIssue: gotoIssue,
    stepBack: () => { LiveCompiler.stepBack(); },
    rewind:   () => { LiveCompiler.rewind(); }
});

NavView.setEvents({
    clickFile: (relativePath) => {
        var inkFile = InkProject.currentProject.inkFileWithRelativePath(relativePath);
        InkProject.currentProject.openInkFile(inkFile);
    }
});