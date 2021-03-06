"use strict";

/// Global variables

var exerciseButtons = [];  // list of all activated exercise buttons
var exerciseList = [];
var exercisesByShortName = {};
var lastClickedButton = "";   // this will be updated to the last deduction button one clicked; prevents double clicking from doing anything
var revealTrueFalse = false;  // do we populate the formula window with true and false?
var sectionTitle = "";  // name of last section to be created
var maxLawIndex = 0;  // the largest index currently assigned to a law
var hideCircularLaws = false; // do we suppress laws that are circular?

/////// CREATING AND UPDATING HTML ELEMENTS /////////////

function getElement(id) {
    return document.getElementById(id);
}

// a standard box

function newBox() {
    var box = document.createElement("DIV");
    box.className = "clickable";
    box.style.float = "left";
    box.style.margin = "5px";
    box.style.padding = "0px 10px";
    box.style.backgroundColor = "white";
    box.style.cursor = "pointer";
    return(box);
}

// a standard heading

function newHeading(text) {
    var header = document.createElement("H4");
    header.innerHTML = text;
    header.style.margin = "0px";
    return header;
}

// a standard button

function newButton(text) {
    var button = document.createElement("BUTTON");
    button.innerHTML = text;
    return button;
}

function createResetButton() {
    var button = getElement("reset-button");
     button.onclick =  function() {
        if (confirm("Are you sure?  This will erase all your progress!")) {
            if (localStorage)
                localStorage.clear();
            location.reload();
        }
    };
    return button;
}

// custom prompt window

function myprompt(message, defaultContent, callback) {
    let prompt = document.createElement("div");
    prompt.classList.add("popup");
    let label = document.createElement("label");
    let text = document.createTextNode(message);
    label.appendChild(text);
    let input = document.createElement("input");
    input.value = defaultContent;
    label.appendChild(input);
    prompt.appendChild(label);
    let cancel = document.createElement("button");
    cancel.textContent = "Cancel";
    prompt.appendChild(cancel);
    let ok = document.createElement("button");
    ok.textContent = "Ok";
    prompt.appendChild(ok);
    document.body.appendChild(prompt);

    function close() {
      document.body.removeChild(prompt);
    }

    function apply() {
      callback(input.value);
    }

    cancel.addEventListener("click", close);
    ok.addEventListener("click", close);
    ok.addEventListener("click", apply);
  }

function createEditStateButton() {
    var button = getElement("edit-state-button");
     button.onclick =  function() {
         if (!localStorage) {
             alert("Local storage is not supported in this browser.");
             return;
         }

         myprompt("Enter new state here: ", JSON.stringify(localStorage), input => {
            if (input == null) return;
            localStorage.clear();
            let newState = JSON.parse(input);
            for (let i in newState) {
              window.localStorage.setItem(i, newState[i]);
            }
            location.reload();
          });

    };
    return button;
}


function createRestartButton() {
    var button = getElement("restart-button");
     button.onclick =  function() {
        var exButton = getElement("exercise").exerciseButton;
        if (exButton == undefined)
            notify("There is currently no exercise to reset.");
        else
            exButton.onclick();
    };
    return button;
}

function createUnsolveButton() {
    var button = getElement("unsolve-button");
     button.onclick =  function() {
        var exButton = getElement("exercise").exerciseButton;
        if (exButton == undefined)
        {
            notify("There is currently no exercise to reset.");
            return;
        }
        if (!exButton.solved)
        {
            notify("This exercise has not yet been solved.");
            return;
        }
        exButton.solved = false;

        var exercise = exButton.exercise;
        exercise.personalBest = 1000;

        if (localStorage) {
            localStorage.setItem(exercise.name, "unlocked");
            localStorage.removeItem("lines " + exercise.name);
            localStorage.removeItem("proof " + exercise.name);
        }
    
        exButton.onclick();
    };
    return button;
}

function createUndoButton() {
    var button = getElement("undo-button");
    button.canUndo = false;   // whether undo is available
    button.deletionList = []; // list  of elements to be deleted on undo
    button.numlines = 0;  // what to rewind numlines back to

    button.onclick = function() {
        if (!button.canUndo) {
            notify("Sorry, UNDO is only available immediately after making a deduction that does not solve the exercise.");
            return;
        }
        button.canUndo = false;
        getElement("proof").numlines = button.numlines;
        getElement("proof").hasCircularity = button.hasCircularity;
        getElement("undo-button").deletionList.forEach( function(item) { item.remove(); });
        notify("The deduction that was just made has now been undone.");
        lastClickedButton = "";  // no longer need duplication prevention
    };

    return button;
}

function createPrevExerciseButtons() {
    var button = getElement("prev-exercise");

    button.onclick = function() {
        var exercise = getElement("exercise").exercise;
        var num, i;

        for (i=0; i < exerciseList.length; i++)
            if (exerciseList[i] == exercise) {
                num = i; break;
            }

        if (num==0) return;
        var newExercise = exerciseList[num-1];
        setExercise(newExercise.button);
    };

    return button;
}

function createNextExerciseButtons() {
    var button = getElement("next-exercise");

    button.onclick = function() {
        var exercise = getElement("exercise").exercise;
        var num, i;

        for (i=0; i < exerciseList.length; i++)
            if (exerciseList[i] == exercise) {
                num = i; break;
            }

        if (num==exerciseList.length-1) return;
        var newExercise = exerciseList[num+1];
        if (!newExercise.activated) return;
        setExercise(newExercise.button);
    };

    return button;
}


// create a button that collapses upon clicking.  If log is enabled, it logs the innerHTML on expansion

function newCollapseButton(subnode, log)
{
    var button = newButton("+");
    subnode.style.display = 'none';
    button.subnode = subnode;
    button.onclick = clickCollapse;
    button.log = log;

    return button;
}

function clickCollapse() {
    if (this.innerHTML == '+') {
        this.innerHTML = '-';
        this.subnode.style.display = 'block';
        if (this.log)
            debug(this.subnode.innerHTML);
    }
    else {
        this.innerHTML = '+';
        this.subnode.style.display = 'none';
    }
}

function createAchievementsBox() {
    var box = getElement("achievement-box");

    var heading = newHeading("Achievements");
    box.appendChild(heading);

    var list = document.createElement("UL");
    list.id = "achievements";

    var button = newCollapseButton(list, false);
    heading.appendChild(button);
    box.appendChild(list);

    return box;

}

// record an achievement

function achieve(achievement) {
  var log = getElement("achievements");
  var node = document.createElement("LI");
  var span = document.createElement("SPAN");
  span.innerHTML = achievement;
  node.appendChild(span);
  log.insertBefore(node, log.firstChild);
}

// notifications, error messages, debugging tool

function createNotificationsBox() {
        var box = getElement("notification-box");
        var heading = newHeading("Event log");
        box.appendChild(heading);

        var list = document.createElement("UL");
        list.id = "notifications";

        var button = newCollapseButton(list, false);
        heading.appendChild(button);
        box.appendChild(list);
        return box;
    }


function notify(msg) {
    var log = getElement("notifications");
    var node = document.createElement("LI");
    var span = document.createElement("SPAN");
    span.innerHTML = msg;
    node.appendChild(span);
    log.insertBefore(node, log.firstChild);

    return node;
}

var debugOn = true;

function debug(msg) {
    if (debugOn)
        console.log(msg);
}

function error(msg) {
    notify(msg);
}

// create the proof box

function createProofBox() {
    var box = getElement("proof-box");
    box.appendChild(newHeading("Proof"));
    var list = document.createElement("OL");
    list.id = "proof";
    list.numlines = 0;
    box.appendChild(list);
    return box;
}


// add a line to the proof

function appendToProof(line) {
    var proof = getElement("proof");
    var node = document.createElement("LI");
    var span = document.createElement("SPAN");
    span.innerHTML = line;
    node.appendChild(span);
    proof.appendChild(node);

    // add node to the list of items removed by immediate undo
    getElement("undo-button").deletionList.push(node);
    proof.numlines++;
   }



// create exercise window

function createExerciseBox() {
    var text = getElement("exercise");
    if (localStorage)
    {
        if (localStorage.length != 0)
            text.innerHTML = "";
    }

    text.exercise = "";  // no exercise set yet
    text.exerciseButton = "";

    // a hack to remove the initial hidden nature of this text field
    text.className = "clearfix";

    return text;
}

// add a given hypothesis to main environment
function given(context) {
    addContext(context);

    if (context.type == "sentence in environment")
        appendToProof(context.name + ". <I>[given]</I>");
    else if (context.type == "environment") {
        var needsMention = false; // need to mention context if it contains a "letting" or "setting"
        var i;

        for (i=0; i < context.environment.length; i++)
            if (context.environment[i].type == 'letting' || context.environment[i].type == 'setting')
                needsMention = true;

        if (needsMention)
            appendToProof("Form environment " + context.name + ". <I>[given]</I>");
    }
}

// clear out an element

function clearElement(id) {
    getElement(id).innerHTML = '';
}


// reveal named element
function reveal(name, longName) {
    if (getElement(name).style.display == 'none') {
        achieve("<B>UNLOCKED</B> " + longName + ".");
        getElement(name).style.display = 'block';
        if (localStorage)
            localStorage.setItem(name, "unlocked");
    }
}

function makeArgDroppable(arg, li, i) {
    arg.li = li;
    arg.i = i;
    li.fields[i] = arg;
    arg.setAttribute('ondragover', "allowDrop(event)");
    arg.setAttribute('ondrop', "argDrop(event)");
}

function argDrop(ev) {
    ev.preventDefault();

// arg is the object that is being dragged.
    var arg = getElement(ev.dataTransfer.getData("text"));

    if (arg == null) return;           // this can happen for instance if one drags a selection
    if (arg.type == undefined) return;  // this can happen for instance if one drags a selection
    if (arg.type != "termBox") return;

    var term = arg.term;
    var targ = ev.target;
    var li = targ.li;
    var op = li.operator;
    var i = targ.i;

    targ.innerHTML = term.name;
    li.args[i] = term;

    // if all arguments have been selected, let's go make a term or formula!
    var hasAllArgs = true;
    var j;
    for (j=0; j < op.arity; j++) {
        if (li.args[j] == "") hasAllArgs = false;
    }

    if (!hasAllArgs) return;

    if (op.type == "operator") {
        addContext( termContext( operatorTerm( op, li.args ) ) );
    } else {
        addContext( formulaContext( predicateSentence( op, li.args ) ) );
    }

    // reset the fields to mdashes
    for (j=0; j < op.arity; j++) {
        li.args[j] = "";
        li.fields[j].innerHTML = "&mdash;";
    }
}


function addPredicate(name)
{
    var obj = sentences[name];

    if (obj.arity == 0) return;  // don't bother puting 0-ary predicates or operators on the list (actually these are redundant anyway since atomic predicates and terms are functionally equivalent)

    var li = document.createElement("LI");

    if (obj.type == "operator") getElement("operators-list").appendChild(li);
    if (obj.type == "predicate") getElement("predicates-list").appendChild(li);

    li.operator = obj;
    li.args = [];
    li.fields = [];
    var i;
    for (i=0; i < obj.arity; i++) li.args[i] = "";

    if (obj.arity == 1) {
        var span = document.createElement("SPAN");
        span.innerHTML = obj.name + "(";
        li.appendChild(span);
        var arg = document.createElement("SPAN");
        arg.innerHTML = "&mdash;";
        li.appendChild(arg);
        makeArgDroppable(arg, li, 0);
        var span2 = document.createElement("SPAN");
        span2.innerHTML = ")";
        li.appendChild(span2);
        return;
    }

    // so we now have a binary operator or predicate

    if (obj.relationStyle) {
        var arg1 = document.createElement("SPAN");
        arg1.innerHTML = "&mdash;";
        li.appendChild(arg1);
        makeArgDroppable(arg1, li, 0);
        var span = document.createElement("SPAN");
        span.innerHTML = " " + obj.name + " ";
        li.appendChild(span);
        var arg2 = document.createElement("SPAN");
        arg2.innerHTML = "&mdash;";
        li.appendChild(arg2);
        makeArgDroppable(arg2, li, 1);
    } else {
        var span = document.createElement("SPAN");
        span.innerHTML = obj.name + "(";
        li.appendChild(span);
        var arg1 = document.createElement("SPAN");
        arg1.innerHTML = "&mdash;";
        li.appendChild(arg1);
        makeArgDroppable(arg1, li, 0);
        var span2 = document.createElement("SPAN");
        span2.innerHTML = ", ";
        li.appendChild(span2);
        var arg2 = document.createElement("SPAN");
        arg2.innerHTML = "&mdash;";
        li.appendChild(arg2);
        makeArgDroppable(arg2, li, 1);
        var span3 = document.createElement("SPAN");
        span3.innerHTML = ")";
        li.appendChild(span3);
    }
}
// New exercise in the exercise window

function setExercise(exerciseButton) {

// clear all existing elements
    clearElement("root-environment");
    getElement("root-environment").appendChild(newHeading("Root environment"));

    clearElement("proof");
    getElement("proof").numlines = 0;
    getElement("proof").hasCircularity = false;

    clearElement("deductionDesc");
    getElement("deductionDesc").assumptions = [];
    clearElement("deductions");
    clearElement("deductionFootnote");

    clearElement("formula-window");
    getElement("formula-window").appendChild(newHeading("Formulas"));

    var head = getElement("term-heading");

    clearElement("term-window");
    getElement("term-window").appendChild(head);

    clearElement("predicates-list");
    clearElement("operators-list");

    var exerciseText = getElement("exercise");

    var exerciseDesc = document.createElement("DIV");
    exerciseDesc.id = "exercise-desc";

    var exercise = exerciseButton.exercise;

// Display exercise text
    exerciseDesc.innerHTML = "<H4>Section " + exerciseButton.sectionTitle + "</H4>";
    if (exercise.name == exercise.law.name)
        exerciseDesc.innerHTML += "<B>" + exercise.name + "</B>: " + exercise.law.string;
    else
        exerciseDesc.innerHTML += "<B>" + exercise.name + "</B> <I>(" + exercise.law.name + ")</I>: " + exercise.law.string;

        exerciseText.innerHTML = "";

    exerciseText.appendChild(exerciseDesc);

    if (exercise.bestLength > 0) {
        exerciseText.appendChild(document.createElement("BR"));
        var span = document.createElement("SPAN");
        span.appendChild(document.createTextNode("Shortest known non-circular proof: " + exercise.bestLength + " lines."));
        exerciseText.appendChild(span);
        if (completedAllExercises()) {
            if (exercise.proof != "") {

                var subnode = document.createElement("OL");
                subnode.innerHTML = exercise.proof;

                var button = newCollapseButton(subnode, true);

                span.appendChild(button);
                span.appendChild(subnode);

            }
        }
    }
// Display exercise notes
    if (exercise.notes != "") {
        exerciseText.appendChild(document.createElement("BR"));
        var notes = document.createElement("DIV");
        notes.innerHTML = exercise.notes;
        exerciseText.appendChild(notes);
    }

// Load all given hypotheses
    exercise.law.givens.forEach( function(item) {
        if (item.type == "sentence in environment" || item.type == "environment")
            given(item);
    });

    exerciseText.exercise = exercise;
    exerciseText.exerciseButton = exerciseButton;

// reveal the formula window, if this option is active
    if (exercise.revealFormulaWindow) reveal("formula-window", "<B>Formulas</B> window");
// reveal the term window, if this option is active
    if (exercise.revealTermWindow) reveal("term-window", "<B>Terms</B> window");
// reveal the bound button, if this option is active
    if (exercise.revealBoundButton) reveal("bound-variable-button", "New bound variables button");
// reveal the operators window, if this option is active
    if (exercise.revealOperatorsWindow) reveal("operators-window", "<B>Predicates</B> and <B>Operators</B> window");

// Unlock any laws that were unlocked by the exercise
    exercise.newLaws.forEach( function(item) {
        unlock(item, "UNLOCKED");
    });

// add true and false to formula windows, if revealed

    if (exercise.revealTrueFalse)
    {
        revealTrueFalse = true;
        achieve("<B>UNLOCKED</B> TRUE and FALSE formulas.");
        if (localStorage) {
            localStorage.setItem( "true false", "unlocked");
        }
    }

    if (revealTrueFalse) {
        addContext(formulaContext(TRUE()));
        addContext(formulaContext(FALSE()));
    }


// add each primitive to the formula window

    var primitives = listPrimitives(exercise.law, true, false, false, false,false,false,false, false);
    primitives.forEach( function(name) {
        addContext(formulaContext(name));
    });

    // add each free and bound var and primitive term to the term window

    var Vars = listPrimitives(exercise.law, false, true, true, true,false,false,false, false);
    Vars.forEach( function(name) {
        addContext(termContext(name));
    });

// add each predicate and operator to the operators window

    var Predicates = listPrimitives(exercise.law, false,false,false,false,true,true,false, false);
    Predicates.forEach( function(name) {
        addPredicate(name);
    });



    colorExerciseButton(exercise.button, true);


// can't undo with only the given hypotheses
    getElement("undo-button").canUndo = false;
 }

// create the root environment window

function createRootEnvironment() {
    var box = getElement("root-environment");

    box.style.margin = "5px";
    box.style.padding = "0px 10px";
    box.style.border = "1px solid black";
    box.style.backgroundColor = "#eeeeee";

    box.setAttribute('ondragover', "allowDrop(event)");
    box.setAttribute('ondrop', "drop(event)");
    box.setAttribute('onclick', "clickBox(this,event)");
    box.type = "environment";
    box.appendChild(newHeading("Root environment"));
    return box;
}

// returns the subenvironment of env with assumption in it, or false otherwise

function findAssumption(env,assumption) {
    var i;

    for (i=0; i < env.children.length; i++)
    {
        var child = env.children[i];
        if (child.type == "environment")
        if (child.assumption.name == assumption.name) {
             return child;
        }
    }

  return false;
}

// inside an existing environment, add an assumption subenvironment

function makeAssumption(env, obj) {
    var assumption = toAssumption(obj);
    var box = findAssumption(env,assumption);

    if (box != false) return box;

    box = newBox();
    box.id = uniqueId();
    box.type = "environment";
    box.style.backgroundColor = "#eeeeee";

    box.setAttribute('onclick', "clickBox(this,event)");


    env.appendChild(box);
    box.appendChild(newHeading(assumption.name));
    box.assumption = assumption;

// add box to the list of things removed by an immediate undo
    getElement("undo-button").deletionList.push(box);

    return box;
}

// when creating child environments, remember to set box.type to "environment" and box.assumption to the sentence being assumed.

// create formula window

function createFormulaWindow() {
    var box = getElement("formula-window");

    box.style.display = 'none';
    box.style.margin = "5px";
    box.style.padding = "0px 10px";
    box.style.border = "1px solid black";
    box.style.backgroundColor = "#eeeeee";

    box.setAttribute('ondragover', "allowDrop(event)");
    box.setAttribute('ondrop', "drop(event)");
    box.type = "formula window";
    box.appendChild(newHeading("Formulas"));
    return box;
}

// create term window

function createTermWindow() {
    var box = getElement("term-window");

    box.style.display = 'none';
    box.style.margin = "5px";
    box.style.padding = "0px 10px";
    box.style.border = "1px solid black";
    box.style.backgroundColor = "#eeeeee";

    box.setAttribute('ondragover', "allowDrop(event)");
    box.setAttribute('ondrop', "drop(event)");
    box.type = "term window";
    var div = document.createElement("DIV");
    div.appendChild(newHeading("Terms"));
    div.id = "term-heading";
    box.appendChild(div);

    var freeButton = newButton("New free variable");
    div.appendChild(freeButton);
    freeButton.onclick = freeButtonClick;

    var boundButton = newButton("New bound variable");
    boundButton.style.display = 'none';
    boundButton.id = "bound-variable-button";
    div.appendChild(boundButton);
    boundButton.onclick = boundButtonClick;

    return box;
}

    // add a free variable to the term window
function freeButtonClick() {
    var i;
    var num=0;
    var box = getElement("term-window");

    do
    {
        var str = FreeVariableName(num);
        var match = false;

        for (i=0; i < box.children.length; i++)
        {
            var child = box.children[i];
            if (child.type == "termBox") {
                if (child.term.subtype == "free variable") {
                    if (child.term.argList[0].subtype == str) {
                        match = true;
                    }
                }
            }
        }
        num++;
    }
    while (match);

    addContext(termContext(new FreeVariable(str)));
}

// add a bound variable to the term window
function boundButtonClick() {
    var i;
    var num=0;
    var box = getElement("term-window");

    do {
        var str = BoundVariableName(num);
        var match = false;

        for (i=0; i < box.children.length; i++)    {
            var child = box.children[i];
            if (child.type == "termBox") {
                if (child.term.subtype == "bound variable") {
                    if (child.term.argList[0].subtype == str) {
                        match = true;
                    }
                }
            }
        }
        num++;
    } while (match);

    addContext(termContext(new BoundVariable(str)));
}


function createOperatorsWindow() {
    var box = getElement("operators-window");
    box.style.display = 'none';

    var div;
    var ul;

    div = document.createElement("DIV");
    div.appendChild(newHeading("Predicates"));
    box.appendChild(div);

    ul = document.createElement("UL");
    ul.id = "predicates-list";
    box.appendChild(ul);

    div = document.createElement("DIV");
    div.appendChild(newHeading("Operators"));
    box.appendChild(div);

    ul = document.createElement("UL");
    ul.id = "operators-list";
    box.appendChild(ul);
    return box;
}



// if previous session unlocked formula window, true/false, and/or term window, reveal it; also unlock all laws already unlocked
function checkForUnlocks() {
    if (localStorage) {
        // the string form with spaces instead of hyphens is for backwards compatibility
        if (localStorage.getItem("formula window") == "unlocked" || localStorage.getItem("formula-window") == "unlocked" )
            reveal("formula-window", "<B>Formulas</B> window");

        if (localStorage.getItem("true false") == "unlocked" || localStorage.getItem("true-false") == "unlocked") {
            achieve("<B>UNLOCKED</B> TRUE and FALSE formulas.");
            revealTrueFalse = true;
        }

        if (localStorage.getItem("term window") == "unlocked" || localStorage.getItem("term-window") == "unlocked")
            reveal("term-window", "<B>Terms</B> window");

        if (localStorage.getItem("operators window") == "unlocked" || localStorage.getItem("operators-window") == "unlocked")
            reveal("operators-window", "<B>Predicates<B> and <B>Operators</B> windows");
        if (localStorage.getItem("bound variable button") == "unlocked" || localStorage.getItem("bound-variable-button") == "unlocked")
            reveal("bound-variable-button", "New bound variable button");

        allLaws.forEach( function( law ) {
            // in legacy code, law is stored using the full name
            var str;

            str = localStorage.getItem("law " + law.name);
            
            if (str != null) {
                unlock(law, str);
            }

            // in current version, law is stored using short Name

            str = localStorage.getItem("law " + law.shortName);
            if (str != null) {
                unlock(law, str);
            }
        });

  }

// ensure legacy games from older versions still unlock solved exercises and the laws they in turn unlock
  exerciseList.forEach( function(exercise) {
    if (exercise.button.solved)
        if (localStorage)
        {
            unlock(exercise.law, "PROVED");  
            exercise.newLaws.forEach( function(item) {
                unlock(item, "UNLOCKED");
            });          
        }
  });

}


// unique ID generator for creating new objects
function uniqueId() {
    return 'id-' + Math.random().toString(36).substr(2, 16);
  };

// create a new box with a sentence in it

function newSentenceBox(sentence) {
    var box = newBox();
    box.innerHTML = sentence.name;
    box.setAttribute('draggable', true);
    box.setAttribute('ondragstart', "drag(event)");
    box.setAttribute('onclick', "clickBox(this,event)");
    box.id = uniqueId();
    box.type = "sentenceBox";
    box.sentence = sentence;
    return box;
};


// add a formula to the formula window, or a sentence in environment to the relevant environment

// convert a list of assumptions into an environment box
function getEnvironment(list) {
    var env = getElement("root-environment");
    list.forEach( function(statement) {
        env = makeAssumption(env, statement);
    });
    return env;
}

function addContext(context) {


    if (context.type == "environment")
    {
        // getEnvironment will create the environment if it does not already exist
        getEnvironment(context.environment);
        return;
    }

    if (context.type != "formula" && context.type != "term context" && context.type != "sentence in environment") {
        error("Cannot add this type of context: " + context.type);
        return;
    }

    var box = newBox();

    box.setAttribute('draggable', true);
    box.setAttribute('ondragstart', "drag(event)");
    box.setAttribute('onclick', "clickBox(this,event)");
    box.id = uniqueId();

    if (context.type == "term context") {
        box.term = context.term;
        box.innerHTML = context.term.name;
    }
    else{
        box.sentence = context.sentence;
        box.innerHTML = context.sentence.name;
    }

    if (context.type == "formula") {
        box.type = "formulaBox";
        var nodes = getElement("formula-window").childNodes;
        var i;

        for (i=0; i < nodes.length; i++)
            if (nodes[i].type == "formulaBox")
            if (nodes[i].sentence.name == box.sentence.name) {
                notify("The formula " + box.sentence.name + " is already present in this window.");
                return box;
            }
        getElement("formula-window").appendChild(box);
    } else if (context.type == "term context") {
        box.type = "termBox";
        var nodes = getElement("term-window").childNodes;
        var i;

        for (i=0; i < nodes.length; i++)
            if (nodes[i].type == "termBox")
            if (nodes[i].term.name == box.term.name) {
                notify("The term " + box.term.name + " is already present in this window.");
                return box;
            }

        getElement("term-window").appendChild(box);
    }
    else {
        var env = getEnvironment(context.environment);
        box.type = "sentenceBox";

        var nodes = env.childNodes;
        var i;

        for (i=0; i < nodes.length; i++)
            if (nodes[i].type == "sentenceBox")
            if (nodes[i].sentence.name == box.sentence.name)
            {
                notify("The sentence " + box.sentence.name + " is already present in this window.");
                return box;
            }

        env.appendChild(box);
    }

    // add box to the list of things that can be deleted by undo button
    getElement("undo-button").deletionList.push(box);

    return box;
}

// checks if all exercises have been completed

function completedAllExercises() {
    return exerciseButtons.every( function(button) { return button.solved; } );
}

// checks if exactly one exercise has been completed

function completedOneExercise() {
    var i = 0;

    exerciseButtons.forEach( function (button) { if (button.solved) i++; });

    return (i==1);
}


// adds a collapsible proof (in HTML format) to the element node

function listProof( node, proof ) {

    var subnode = document.createElement("OL");
    subnode.innerHTML = proof;

    var button = newCollapseButton(subnode, true);

    node.appendChild(button);
    node.appendChild(subnode);
}

// correctly color the exercise button (and also the exercise description and proof window, if window is true)

function colorExerciseButton(exerciseButton, windows)
{
    var exercise = exerciseButton.exercise;
    var len = exercise.personalBest;

    if (exerciseButton.solved)
    {
        if (len > exercise.bestLength) {
            exerciseButton.style.backgroundColor = 'blue';
            exerciseButton.style.color = 'white';
            exerciseButton.style.cursor = 'pointer';
            if (windows) {
                getElement("exercise-desc").style.backgroundColor = 'aqua';
                getElement("proof-box").style.backgroundColor = 'aqua';
            }
            return;
        }
        if (len == exercise.bestLength) {
            exerciseButton.style.backgroundColor = 'hsl(150,50%,50%)';
            exerciseButton.style.color = 'white';
            exerciseButton.style.cursor = 'pointer';
            if (windows) {
                getElement("exercise-desc").style.backgroundColor = 'lightgreen';
                getElement("proof-box").style.backgroundColor = 'lightgreen';
            }
            return;
        }
        if (len < exercise.bestLength) {
            exerciseButton.style.backgroundColor = 'lime';
            exerciseButton.style.color = 'white';
            exerciseButton.style.cursor = 'pointer';
            if (windows) {
                getElement("exercise-desc").style.backgroundColor = 'greenyellow';
                getElement("proof-box").style.backgroundColor = 'greenyellow';
            }
            return;
        }
    }

    if (exercise.activated) {
        exerciseButton.style.backgroundColor = 'hsl(60,100%,75%)';
        exerciseButton.style.color = "black";
        exerciseButton.style.cursor = "pointer"
        if (windows) {
            getElement("exercise-desc").style.backgroundColor = 'yellow';
            getElement("proof-box").style.backgroundColor = 'yellow';
        }
        return;
    }

    exerciseButton.style.backgroundColor = 'hsl(0,10%,75%)';
    exerciseButton.style.color = 'white';
    exerciseButton.style.cursor = 'not-allowed';

}

// make a deduction; check for victory condition

function deduce(conclusion, justification, law) {

    getElement("undo-button").canUndo = true;
    getElement("undo-button").deletionList = [];  // list of elements to be deleted on undo
    getElement("undo-button").numlines = getElement("proof").numlines;
    getElement("undo-button").hasCircularity = getElement("proof").hasCircularity;


// add conclusion to either a deduction environment or the formula window, as appropriate.
    addContext(conclusion);

// creating a formula or term is not important enough to mention explicitly in the proof, nor should it trigger a victory condition.
    if (conclusion.type == "formula" || conclusion.type == "term context") return;

    var justificationSentences = justification.filter( function(context) { return (context.type == "sentence in environment"); });

    var name = law.name;

    if (getElement("exercise").exercise != "")
        if (law.index >= getElement("exercise").exercise.law.index) {
            name += "<sp>*</sp>";
            getElement("proof").hasCircularity = true;
        }

    appendToProof( deductionString("From", justificationSentences, conclusion) + " <I>[" + name + "]</I>");




    var exercise = getElement("exercise").exercise;
    var exerciseButton = getElement("exercise").exerciseButton;

    if (exercise != "")
    if (conclusion.name == exercise.law.conclusion.name)
     {
         // hooray, you solved it!  Now one can't undo it.
         getElement("undo-button").canUndo = false;

        if (!exerciseButton.solved) {
            appendToProof('QED!');
            unlock(exercise.law, "PROVED");
            exerciseButton.solved = true;

            if (localStorage)
                localStorage.setItem(exercise.name, "solved");
            exercise.newExercises.forEach( function(item) {
                activateExerciseButton(item, false);
             });

            if (completedOneExercise())
                alert('Congratulations, you solved your first exercise!  Now two more exercises will be unlocked, as well as the next section of the text.  (For subsequent exercises, we will notify you of an exercise being solved by changing the color of the exercise and its proof to either green or blue, depending on whether you found the shortest known proof or not.  We also add a QED symbol (standing for "quod erat demonstrandum", or "what was to be demonstrated") to the end of the proof.)');

            if (completedAllExercises()) {
                alert("Congratulations, you completed all the exercises! You are now a master of propositional and first-order logic!  The next time one clicks on an exercise, one should now see a button next to the shortest length proof message which, when clicked, will reveal the shortest known proof for that exercise.");
                achieve("<B>COMPLETED</B> all the exercises!");
            }
        } else {
            appendToProof('QED! (again)');
            unlock(exercise.law, "PROVED");  // this is to give legacy games from older versions a chance to re-unlock the exercise
        }

        var len = getElement("proof").numlines;
        var node;
        var proof = getElement("proof").innerHTML;

        if (getElement("proof").hasCircularity) {
            notify(exercise.name + " was proved in " + len + " lines, using laws obtained after the exercise was first solved.");
        }
        else {
            if (localStorage) {
                var oldlen = localStorage.getItem("lines " + exercise.name);
                if (oldlen == undefined)
                {
                    node = notify(exercise.name + " was proved in " + len + " lines.");
                    localStorage.setItem("lines " + exercise.name, len);
                    localStorage.setItem("proof " + exercise.name, proof);
                } else if (oldlen > len) {
                    node = notify(exercise.name + " was reproved in " + len + " lines.  A new personal best!");
                    localStorage.setItem("lines " + exercise.name, len);
                    localStorage.setItem("proof " + exercise.name, proof);
                } else {
                    node = notify(exercise.name + " was reproved in " + len + " lines.");
                }
            }
            else
                node = notify(exercise.name + " was proved in " + len + " lines.");

            listProof( node, proof );

            if (len < exercise.personalBest) exercise.personalBest = len;

            if (len == exercise.bestLength)
            {
                notify("You matched the record for the shortest known proof of " + exercise.name + "!");
            }
            if (len < exercise.bestLength)
                alert("You beat the record for the shortest known proof of " + exercise.name + "!  Please send it to me at tao@math.ucla.edu and I will update the record (with an acknowledgment) in the next version of the text.");
        }

        colorExerciseButton(exerciseButton, true);
     }
  }

//// ExerciseButton ////

function createExerciseButtonBox() {
    var box = getElement("exercise-button-box");

    var subnode = getElement("exercise-button-subbox");

    var button = newCollapseButton(subnode, false);

    box.appendChild(button);
    box.appendChild(document.createElement("BR"));
    box.appendChild(subnode);
}

function createExerciseButton( exercise) {
    var button = newButton(exercise.shortName);
    button.exercise = exercise;
    button.className = "clickable";
    button.enabled = false;
    button.solved = false;
    button.style.width = "50px";
    button.style.paddingLeft = "0px";
    button.style.paddingRight = "0px";
    button.sectionTitle = sectionTitle;

    exercise.button = button;

    getElement("exercise-button-subbox").lastChild.lastChild.appendChild(button);
    return button;
}

function exerciseFromShortName(shortName) {
    var args = exerciseData[shortName];
    if (!args) {
        throw new Error("exercise shortName not found: " + shortName);
    }
    exerciseFromData(shortName, args);
}

function newSection(section, name) {
    var box = getElement("exercise-button-subbox");
    var div = document.createElement("DIV");
    div.style.clear = "both";
    div.className = "clearfix";

    var span = document.createElement("SPAN");
    sectionTitle = section + ". " + name;
    span.innerHTML = sectionTitle;
    span.style.float = "left";
    span.style.clear = "left";
    span.style.width = "200px";
    var rightBox = document.createElement("SPAN");
    rightBox.style.float = "left";
    rightBox.style.clear = "right";
    div.appendChild(span);
    div.appendChild(rightBox);
    box.appendChild(div);

    // load all exercises starting with section

    Object.keys(exerciseData).forEach( function(key) {
        if (key.indexOf(section + ".") == 0)
        {
            exerciseFromShortName(key);
        }
    });
}


// fromStorage is true if one is activating the button because localStorage reports that it was previously activated. In which case we hide the "now available" notification.

function activateExerciseButton(exercise, fromStorage) {
    exercise.activated = true;

    var button = exercise.button;

    if (button.enabled) return;
    button.enabled = true;

    button.onclick =  function() {
        setExercise(this);
    };

    if (!fromStorage) notify(exercise.name + " now available.")
    exerciseButtons.push(button);
    if (localStorage) {
        if (localStorage.getItem(exercise.name) == undefined) {
            localStorage.setItem(exercise.name, "unlocked");
        }

        var len = localStorage.getItem("lines " + exercise.name);
        if (len != undefined) {
            var node = notify(exercise.name + " was proven in " + len + " lines.");
            var proof = localStorage.getItem("proof " + exercise.name);
            listProof(node, proof);
            exercise.personalBest = len;
            button.solved = true;
        }
    }

    colorExerciseButton(button, false);

    return button;
}

// create the box of available deductions

function createDeductionsBox() {
    var box = getElement("deductions-box");
    box.style.margin = "5px";
    box.style.padding = "0px 10px";

    box.appendChild(newHeading("Available deductions"));

    var desc = document.createElement("DIV");
    desc.id = "deductionDesc";
    box.appendChild(desc);

    var list = document.createElement("OL");
    list.id = "deductions";
    box.appendChild(list);

    var footnote = document.createElement("DIV");
    footnote.id = "deductionFootnote";
    box.appendChild(footnote);
}

// list the assumptions used when searching for deductions

function from( assumptions )
{
    var desc = getElement("deductionDesc");

    var shortStr = "From ";
    var longStr = "From ";

    getElement("undo-button").canUndo = false;  // there was an exploit where one set up a deduction, undid the hypothesis enabling that deduction, and then executed the deduction anyway, to save a proof line step

    assumptions.forEach( function( assumption ) {
        shortStr = longStr + toContext(assumption).name;
        longStr = shortStr + ", ";
    });

    desc.innerHTML = shortStr + ":";
    desc.assumptions = assumptions;

    clearElement("deductions");
    clearElement("deductionFootnote");
}


// add a line to available deductions

function appendToDeductions(output, justification, law) {
    var proof = getElement("deductions");
    var name = law.name;

    if (getElement("exercise").exercise != "")
        if (law.index >= getElement("exercise").exercise.law.index) {
            // we have circularity!
            if (hideCircularLaws) return false;  
            name += "<sup>*</sup>";
            proof.hasCircularity = true;
        }

    if (output.multivalued) {
        var i;
        for (i=0; i < output.conclusions.length; i++)
            appendConclusion(output.conclusions[i], justification, output.illegal, name, law);

    }
    else {
        appendConclusion(output.conclusion, justification, output.illegal, name, law);
    }

    return true;
}




// unlock a law, make it available for use in future deductions

function unlock(law, text) {
    if (law.unlocked) return;  // prevent duplicate unlocking
    law.unlocked = true;
    unlockedLaws.push(law);
    achieve("<B>" + text + "</B> " + "<I>"+ law.name+"</I>: " + law.string);
    
    if (localStorage)
        localStorage.setItem("law " + law.shortName, text);

    // If the law has no environment but produces a conclusion in the root environment, add a version of the law in which the environment is relative.

    if (law.clone != "")
    {
        unlock(law.clone, text);
    }
}


// append a single conclusion to the deductions list with justification "justification" and law name "name".  If "illegal", silver out the deduction

function appendConclusion(conclusion, justification, illegal, name, law) {
    var proof = getElement("deductions");
    var node = document.createElement("LI");
    var span = document.createElement("SPAN");

    span.innerHTML = "<I>" + name + "</I>:";
    node.appendChild(span);

    if (isLegal(conclusion) && !illegal)
    {
        var button = newButton( conclusion.name);
        button.conclusion = conclusion;
        button.justification = justification;
        button.onclick =  function() {
            if (this == lastClickedButton) return;  // prevent double click from doing anything
            lastClickedButton = this;
            deduce(this.conclusion, this.justification, law);
        };
        node.button = button;
        node.isLegal = true;
        node.appendChild(button);
    }
    else {
        node.isLegal = false;
        var span2 = document.createElement("SPAN");
        span2.innerHTML = conclusion.name;
        span2.style.color = "silver";
        node.appendChild(span2);
        proof.hasIllFormed = true;
    }
    proof.appendChild(node);
}




// Exercise object

function makeExerciseName(shortName) {
    return "EXERCISE " + shortName;
}

// Register an exercise from givens and conclusion, or from the shortname of an existing law

function exerciseFromData(shortName, args) {
    var law;

// relying here on the fact that different input types have different length; probably not the most proper solution
    switch(args.length) {
        case 1:
            law = lawsByShortName[args[0]];
            break;
        case 2: 
            law = new Law(shortName, makeExerciseName(shortName), args[0], args[1]);
            break;
        case 4:  // in this case we also supply an alternate givens/conclusion pair as a matching template
            law = new Law(shortName, makeExerciseName(shortName), args[0], args[1]);
            law.givensTemplate = [];
            args[2].forEach( function(given) {
                law.givensTemplate.push(toContext(given));
             });
            law.conclusionTemplate = toContext(args[3]);
            if (law.clone != "") {
                var givensTemplateClone = law.givensTemplate.slice(0);
                givensTemplateClone.push(rootEnvironmentContext());
                law.clone.givensTemplate = givensTemplateClone;
                law.clone.conclusionTemplate = law.conclusionTemplate;
            }
            break;
    }

    // We don't actually need to return the object.
    new Exercise(shortName, law);
}

function Exercise(shortName, law) {
    if (!(law instanceof Law)) {
        throw new Error('law argument is not a Law object: ' + law);
    }

    this.shortName = shortName;
    this.name = makeExerciseName(shortName);
    this.law = law;

    maxLawIndex++;
    this.law.index = maxLawIndex;

    if (this.law.clone != "") {
        this.law.clone.index = this.law.index;
    }


    this.newLaws = []; // an array of laws unlocked when exercise is attempted(can be empty)
    this.newExercises = [];  // an array of exercises unlocked when exercise is completed (empty by default)
    this.completionMsg = "";  // message upon completion of exercise (default empty)
    this.notes = "";  // notes to make when an exercise is set
    this.revealFormulaWindow = false;  // do we reveal the formula window when this exercise opens?
    this.revealTermWindow = false;  // do we reveal the term window when this exercise opens?
    this.revealTrueFalse = false;  // do we populate formulas window with true and false?
    this.revealBoundButton = false; // do we reveal the new Bound var button?
    this.revealOperatorsWindow = false;  // do we reveal the operators window?
    this.bestLength = 1000;  // the shortest length proof I know of (w/o cheating)
    this.proof = ""; // the innerHTML of the best proof
    this.personalBest = 1000; // personal best length for proof
    this.activated = false;  // whether this exercise has been unlocked


    this.unlocks = function( law ) {
        this.newLaws.push(law);
        law.index = this.law.index - 1; // this can cause some laws to share the same index, but this is OK

        if (law.clone != "") {
            law.clone.index = law.index;
        }
    };

    this.button = createExerciseButton(this);

    if (localStorage) {
        var str = localStorage.getItem(this.name);

        if (str == "unlocked" || str == "solved") {
           activateExerciseButton(this, true);
           if (str == "solved") {
            this.solved = true;
            this.button.solved = true;
            this.personalBest = localStorage.getItem("lines " + this.name);        
            }
        }
    }

    this.unlockedBy = function( prerequisite ) {
        prerequisite.newExercises.push(this);
        if (prerequisite.button.solved)
        {
// this is needed if the dependency graph for the text has updated and one doesn't want to reset the text
            activateExerciseButton(this, false);
        }
    };

    exerciseList.push(this);
    exercisesByShortName[shortName] = this;
}




////////////////////// ACTIONS //////////////////

// ev.target is not always the box or environment that one wishes to manipulate due to the fact that one may have dropped onto a suboject.   So one has to pop up until one has a valid object

function correctTarget(ev) {
    var targ = ev.target;

    if (targ == undefined) return targ;  // nothing can be done in this case
    if (targ == null) return targ;  // nothing can be done in this case

    while (targ.type != "environment" && targ.type != "sentenceBox" && targ.type != "formulaBox" && targ.type != "formula window" && targ.type != "termBox")
      targ = targ.parentElement;

    return targ;
}

// click a sentence box

function clickBox(box,event) {

    // stop parent box from also triggering
    event.stopPropagation();

    // ctrl-click (or meta-click for macOS) adds an assumption to the current list
    if (event.ctrlKey || event.metaKey)
    {
        var assumptions = getElement("deductionDesc").assumptions;
        if (assumptions == undefined) assumptions = [];
        assumptions.push(toContext(box));
        getElement("deductionDesc").box = box;
        makeMatches(assumptions);
    }
    else {
        getElement("deductionDesc").box = box;
        makeMatches([toContext(box)]);
    }
}


// find and list all the deductions that can be made from an array of hypotheses

function makeMatches(justification) {
    // list the justifications at the top of the Available deductions window
    from( justification );

    // if there are precisely two justifications, also consider what can be derived from their reversal. In principle one could extend this to the case of three or more justifications, but I didn't do so.
    var revJustification;
    if (justification.length == 2)
      revJustification = [justification[1], justification[0]];

    var numMatches = 0;
    var proof = getElement("deductions");
    proof.hasCircularity = false;
    proof.hasIllFormed = false;


    unlockedLaws.forEach( function(law) {

        // collect: free variables, bound variables, primitive terms, atomic sentences

        var primitives = listPrimitives(law, false, true, true, true,false,false,true, true);

        var output = matchWithGivens( justification, law, primitives);

        if (output.matches) {
            if (appendToDeductions(output, justification, law))
                numMatches++;
        }

        if (justification.length == 2) {
            output = matchWithGivens( revJustification, law, primitives);

            if (output.matches) {
                if (appendToDeductions(output, revJustification, law))
                    numMatches++;
            }
        }
    });

    if (numMatches == 0) {
        var node = document.createElement("LI");
        var span = document.createElement("SPAN");
        span.innerHTML = "No available deductions can be formed from this selection.";
        node.appendChild(span);
        proof.appendChild(node);
    }

    var footnote = getElement("deductionFootnote");

    if (proof.hasCircularity)
    {
        footnote.innerHTML = "<sup>*</sup> These rules occur in the text at or after the current exercise.  While valid for use in proofs, they will not qualify for shortest proof records. Press 'c' to toggle availability of such rules.";
    }
    if (proof.hasIllFormed) {
        if (footnote.innerHTML != "") footnote.innerHTML += "<BR>";
        footnote.innerHTML += 'Deductions in <span style="color:silver">silver</span> cannot be made, as either the conclusion or a term used are not well formed in the indicated environment (e.g., because they use free variables that are not available in that environment, or have nested quantifications over the same bound variable).';
    }
}

// remember the ID of the object being dragged.

function drag(ev) {
   ev.dataTransfer.setData("text", ev.target.id);
 }


function allowDrop(ev) {
    ev.preventDefault();
}

function drop(ev) {
    ev.preventDefault();

// arg1 is the object that is being dragged.
    var arg1 = getElement(ev.dataTransfer.getData("text"));
    var arg2 = correctTarget(ev);

    if (arg1 == null) return;           // this can happen for instance if one drags a selection
    if (arg1.type == undefined) return;  // this can happen for instance if one drags a selection

    if (arg2.type == "formula window")
     {
         // dragging a sentence box to the formula window creates a new formula
         if (arg1.type == "sentenceBox") {
            addContext(formulaContext(arg1.sentence));
            return;
         }
        return;
     }


     makeMatches([toContext(arg1), toContext(arg2)]);
}


// use keyboard numbers for the first 9 links in deduction menu

function keydown(event) {

    if (event.key == 'u' || event.key == 'U')
        getElement("undo-button").onclick();

    if (event.key == 'r' || event.key == 'R')
        getElement("restart-button").onclick();

        if (event.key == 'l') {

            unlockedLaws.forEach( function(law) {
                debug("law " + law.name + " has index " + law.index);
            });
        }

    if (event.key == '<')
        getElement("prev-exercise").onclick();

    if (event.key == '>')
        getElement("next-exercise").onclick();

    if (event.key == 'c') {
        hideCircularLaws = !hideCircularLaws;
        makeMatches(getElement("deductionDesc").assumptions);
    }

// click the first unsolved exercise, if such exists
    if (event.key == 'n') {
        var i;
        for (i=0; i < exerciseList.length; i++) {
            if (exerciseList[i].button.enabled && !exerciseList[i].button.solved) {
                exerciseList[i].button.onclick();
                return;
            }
        }
    }

    // click the last unsolved exercise, if such exists
    if (event.key == 'N') {
        var i;
        for (i=exerciseList.length; i--;) {
            if (exerciseList[i].button.enabled && !exerciseList[i].button.solved) {
                exerciseList[i].button.onclick();
                return;
            }
        }
    }

    // delete selected item, if it is not the root environment

    if (event.key == 'Delete') {
        var assumptions = getElement("deductionDesc").assumptions;
        if (assumptions.length != 1) return;
        var box = getElement("deductionDesc").box;
        if (box == getElement("root-environment")) {
            notify("Cannot delete root environment.");
            return;
        }
        getElement("undo-button").canUndo = false;  // can't undo a delete
        box.remove();
    }

    var num = parseInt(event.key);

    if (num >= 1 && num <= 9) {
        var items = getElement("deductions").getElementsByTagName("LI");
        if (num <= items.length)
         {
             if (items[num-1].isLegal)
                items[num-1].button.onclick();
         }
    }
}