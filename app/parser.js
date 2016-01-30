var _ = require('lodash');
var jsep = require('jsep');
var ProcessingParser = {};
var setupParser = require('../web_modules/processing-js/Parser');
setupParser(ProcessingParser);
var maxVariableCount = 5;
function parse(parsingBody, indent, variables) {
    if (indent === void 0) { indent = 0; }
    if (variables === void 0) { variables = []; }
    var bodies = [];
    try {
        var body = [];
        var forStepSentences = null;
        _.forEach(parsingBody.statements, function (s) {
            var className = s.constructor.name;
            if (_.has(s, 'body')) {
                try {
                    bodies = bodies.concat(parse(s.body, indent));
                }
                catch (e) {
                    console.error(e);
                }
            }
            else if (_.has(s, 'definitions')) {
                _.forEach(s.definitions, function (d) {
                    if (d.value.expr != null) {
                        var vn = getVariableName(d.name, variables);
                        addSentence("=" + vn + " " + parseExpression(d.value.expr, variables), indent, body);
                    }
                });
            }
            else if (_.has(s, 'expression')) {
                if (s.expression.expr.length > 0) {
                    addSentence(parseAssignExpression(s.expression.expr, variables), indent, body);
                }
            }
            else if (className === 'AstForStatement') {
                _.forEach(s.argument.initStatement.definitions, function (d) {
                    var vn = getVariableName(d.name, variables);
                    addSentence("=" + vn + " " + parseExpression(d.value.expr, variables), indent, body);
                });
                addSentence("while " + parseExpression(s.argument.condition.expr, variables), indent, body);
                var steps = s.argument.step.expr.split(',');
                forStepSentences = _.map(steps, function (s) {
                    return parseAssignExpression(s.trim(), variables);
                });
            }
            else if (className === 'AstPrefixStatement') {
                if (s.argument == null || s.argument.expr == null) {
                    addSentence("" + s.name, indent, body);
                }
                else {
                    addSentence(s.name + " " + parseExpression(s.argument.expr, variables), indent, body);
                }
            }
            else if (className === 'AstStatementsBlock') {
                var blockBody = parse(s, indent + 1, variables)[0];
                if (blockBody == null) {
                    throw 'invalid block';
                }
                body = body.concat(blockBody);
                if (forStepSentences != null) {
                    _.forEach(forStepSentences, function (s) {
                        addSentence(s, indent + 1, body);
                    });
                    forStepSentences = null;
                }
            }
        });
        var fb = _(body)
            .filter(function (sentence) { return sentence.trim().length > 0; })
            .map(function (sentence) { return sentence.split(/[ ]+/).join(' '); })
            .value();
        if (indent > 0 || checkBody(fb)) {
            bodies.push(fb);
        }
    }
    catch (e) {
        console.error(e);
    }
    return bodies;
}
exports.parse = parse;
function checkBody(body) {
    return (_.some(body, function (sentence) {
        return _.some(sentence.split(' '), function (t) {
            return t.length >= 2 && t.indexOf('/') >= 0;
        });
    }));
}
var prevSentence = '';
var prevIndent = 0;
function addSentence(sentence, indent, body) {
    if (prevSentence === 'else' && _.startsWith(sentence, 'if') && indent === prevIndent) {
        body.pop();
        sentence = sentence.replace('if', 'elif');
    }
    if ((_.startsWith(prevSentence, 'if') ||
        _.startsWith(prevSentence, 'for') ||
        _.startsWith(prevSentence, 'while')) &&
        indent == prevIndent) {
        indent++;
    }
    body.push(_.times(indent, function () { return '\t'; }).join('') + sentence);
    prevSentence = sentence;
    prevIndent = indent;
}
var assignOps = ['+=', '-=', '*=', '/=', '%=', '++', '--', '='];
function parseAssignExpression(expr, currentVariables) {
    var isAo = false;
    var result;
    _.forEach(assignOps, function (ao) {
        var io = expr.indexOf(ao);
        if (io >= 0) {
            var varName = expr.substr(0, io).trim();
            var vn = getVariableName(varName, currentVariables);
            var asExpr = expr.substr(io + ao.length).trim();
            result = "" + ao + vn;
            if (asExpr.length > 0) {
                result += " " + parseExpression(asExpr, currentVariables);
            }
            isAo = true;
            return false;
        }
    });
    if (isAo) {
        return result;
    }
    return parseExpression(expr, currentVariables);
}
function parseExpression(expr, currentVariables) {
    return parseJsepExpression(jsep(expr), currentVariables);
}
var unchangedLiterals = ['0', '1', 'true', ' false'];
var reservedIdentifiers = [
    'HALF_PI', 'PI', 'QUATER_PI', 'TAU', 'TWO_PI',
    'POINTS', 'LINES', 'TRIANGLES', 'TRIANGLE_FAN', 'TRIANGLE_STRIP', 'QUADS', 'QUAD_STRIP',
    'CLOSE',
    'LEFT', 'CENTER', 'RIGHT',
    'THRESHOLD', 'GRAY', 'OPAQUE', 'INVERT', 'POSTERIZE', 'BLUR', 'ERODE', 'DILATE',
    'mouseX', 'mouseY', 'pmouseX', 'pmouseY', 'mouseButton',
    'width', 'height'
];
var globalMembers = ProcessingParser.getGlobalMembers();
var unusedFuncNames = [
    'size', 'background', 'noLoop', 'remove', 'exit', 'redraw',
    'noCursor', 'fullScreen', 'frameRate',
    'getURL', 'getURLPath', 'getURLParams',
    'loadFont', 'loadJSON', 'loadStrings', 'loadTable', 'loadXML',
    'loadImage', 'loadShape',
    'httpGet', 'httpPost', 'httpDo', 'link',
    'save', 'saveJSON', 'saveStrings', 'saveTable',
    'saveFrame',
    'print', 'println',
    'texture',
    'textFont', 'createFont',
    'camera',
    'lights', 'noLights',
    'ambientLight', 'directionalLight', 'pointLight', 'spotLight', 'lightSpecular',
    'sphere', 'sphereDetail', 'box',
    'shape', 'hint',
    'parseInt', 'parseFloat', 'parseByte',
    'image',
    'lerpColor',
    'noStroke', 'noFill',
];
var changingFuncNames = {
    'pushMatrix': 'push',
    'popMatrix': 'pop',
    'rotateX': 'rotate',
    'rotateY': 'rotate',
    'rotateZ': 'rotate',
    'mousePressed': 'mouseIsPressed'
};
function parseJsepExpression(expr, currentVariables) {
    switch (expr.type) {
        case 'CallExpression':
            var funcName;
            if (_.has(expr.callee, 'object')) {
                funcName = expr.callee.object.name + "." + expr.callee.property.name;
            }
            else {
                funcName = expr.callee.name;
            }
            if (!(_.has(globalMembers, funcName))) {
                throw "unknown function: " + funcName;
            }
            if (_.find(unusedFuncNames, function (f) { return f === funcName; }) != null) {
                return '';
            }
            var cf = changingFuncNames[funcName];
            if (cf != null) {
                funcName = cf;
            }
            return _.reduce(expr.arguments, function (p, a) {
                return p + (" " + parseJsepExpression(a, currentVariables));
            }, funcName + "/" + expr.arguments.length).trim();
        case 'Literal':
            var ltr = expr.value.toString();
            if (_.find(unchangedLiterals, function (ul) { return ul === ltr; }) != null) {
                return ltr;
            }
            else {
                return _.map(ltr, function (c) { return (c >= '0' && c <= '9') ? 'D' : c; }).join('');
            }
        case 'Identifier':
            var idt = expr.name;
            if (_.find(reservedIdentifiers, function (ri) { return ri === idt; }) != null) {
                return idt;
            }
            else {
                return getVariableName(idt, currentVariables);
            }
        case 'BinaryExpression':
        case 'LogicalExpression':
            var l = parseJsepExpression(expr.left, currentVariables);
            var r = parseJsepExpression(expr.right, currentVariables);
            return expr.operator + " " + l + " " + r;
        case 'UnaryExpression':
            var a = parseJsepExpression(expr.argument, currentVariables);
            return expr.operator + " " + a;
        default:
            throw "unknown expression: " + JSON.stringify(expr);
    }
}
function getVariableName(name, variables) {
    var vi = _.findIndex(variables, function (v) { return v === name; });
    if (vi >= 0) {
        return "V" + vi % maxVariableCount;
    }
    else {
        variables.push(name);
        return "V" + (variables.length - 1) % maxVariableCount;
    }
}
//# sourceMappingURL=parser.js.map