/*
 * Copyright (C) 2017 Elvis Teixeira
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var terminal = { VERSION: 0.1 };

terminal.Terminal = function(args) {
    // Required argument
    if (!args.textArea) {
        throw Error('Terminal constructor needs an HTML text area');
    }
    // Other arguments
    this.serverTokens = args.serverTokens;
    // Arguments with default values
    let textArea = this.textArea = args.textArea;
    let prompt = this.prompt = args.prompt || 'terminal: ';
    let self = this;
    this.style = {
        background: '#1A1A1A',
        color: '#1AFF1A',
        minWidth: '500px',
        maxWidth: '1200px',
        minHeight: '400px',
        border: 'solid 5px lightgray',
        margin: '20px 20px',
        padding: '20px 20px',
        fontSize: '13pt',
        lineHeight: '150%',
        fontFamily: 'monospace',
    };
    // style the textarea HTML element giving precedence to user settings
    if (args.style) {
        for (let prop in args.style) {
            this.style[prop] = args.style[prop];
        }
    }
    for (let prop in this.style) {
        textArea.style[prop] = this.style[prop];
    }
    // Of cource we start we a prompt
    textArea.value = prompt;
    // Capture interesting gui events and save cursor position for the case of
    // events that put the cursor before the last prompt (invalid in terminals)
    // for key events
    textArea.onkeydown = function(event) {
        self.savedCursor = self.cursor();
        if (event.keyCode == 13) {
            self.onEnterPress(event);
        } else if (event.keyCode == 36) {
            self.checkCursor('home', event);
        } else if (event.keyCode >= 37 && event.keyCode <= 40) {
            self.checkCursor('arrow', event);
        }
    }
    // The same for mouse events
    textArea.onmousedown = function(event) {
        self.savedCursor = self.cursor();
    }
    textArea.onmouseup = function(event) {
        self.checkCursor('mouse', event);
    }
}

terminal.Terminal.prototype.cursor = function (start, end) {
    if (!start && !end) {
        return this.textArea.selectionStart;
    }
    this.textArea.selectionStart = start;
    this.textArea.selectionEnd = end || start;
}

terminal.Terminal.prototype.checkCursor = function(cause, event) {
    // don't allow the cursor to go before the last prompt
    // let's emulate the behaviour of a linux terminal
    let lastPromptEnd = this.textArea.value.
        lastIndexOf(this.prompt) + this.prompt.length;
    let selectionStart = this.textArea.selectionStart;
    let selectionEnd = this.textArea.selectionEnd;
    // on mouse 'up' check the cursor in invalid position AND
    // there is no text selection
    if (cause === 'mouse' &&
        selectionStart < lastPromptEnd &&
        selectionStart == selectionEnd) {
            this.cursor(lastPromptEnd);
    }
    // on an arrow key pres check it will not put the sursor
    // in an invalid position
    // arrow left  ==> prevent from going over the prompt
    // arrows up and down ==> turn into scrolling
    if (cause === 'arrow') {
        if (event.keyCode == 37 && selectionStart == lastPromptEnd) {
            event.preventDefault();
        }
        else if (event.keyCode == 38) {
            event.preventDefault();
            this.textArea.scrollTop -= 10;
        }
        else if (event.keyCode == 40) {
            event.preventDefault();
            this.textArea.scrollTop += 10;
        }
    }
    // on home key go to just after the prompt instead of
    // beginning of line
    if (cause === 'home') {
        event.preventDefault();
        this.cursor(lastPromptEnd);
    }
}

terminal.Terminal.prototype.onEnterPress = function(event) {
    event.preventDefault();
    let content = this.textArea.value;
    let lastCommand = content.substr(
        content.lastIndexOf(this.prompt) + this.prompt.length);
    if (lastCommand.length > 0) {
        this.postCommand(lastCommand);
    }
}

terminal.Terminal.prototype.postCommand = function(command) {
    let postData = { cmd: command };
    let self = this;
    if (this.serverTokens) {
        // These user defined values to be passed to servers are useful for
        // security e.g: CSRF tokens
        for (let prop in this.serverTokens) {
            postData[prop] = this.serverTokens[prop];
        }
    }
    $.ajax({
        type: 'POST',
        url: '/terminal/command/',
        data: postData,
        success: function(result) {
            self.onCommandFinished({
                data: result,
                error: false
            });
        },
        error: function(result) {
            self.onCommandFinished({
                data: result,
                error: true
            });
        },
    });
}

terminal.Terminal.prototype.onCommandFinished = function(args) {
    let commandOutput = '';
    if (args.data) {
        commandOutput = args.data;
    }
    this.textArea.value = this.textArea.value +
        '\n' + commandOutput + '\n' + this.prompt;
    this.textArea.scrollTop = this.textArea.scrollHeight;
}
