import * as _ from 'lodash';
declare let require: any;
let jsep = require('jsep');

let ProcessingParser: any = {};
let setupParser = require('../web_modules/processing-js/Parser');
setupParser(ProcessingParser);

const maxVariableCount = 5;

export function parse(parsingBody, indent = 0, variables: string[] = []) {
    let bodies = [];
    try {
        let body = [];
        let forStepSentences = null;
        _.forEach(parsingBody.statements, (s) => {
            let className = s.constructor.name;
            if (_.has(s, 'body')) {
                try {
                    bodies = bodies.concat(parse(s.body, indent));
                } catch (e) {
                    console.error(e);
                }
            } else if (_.has(s, 'definitions')) {
                _.forEach(s.definitions, (d) => {
                    if (d.value.expr != null) {
                        let vn = getVariableName(d.name, variables);
                        addSentence(`=${vn} ${parseExpression(d.value.expr, variables)}`,
                            indent, body);
                    }
                });
            } else if (_.has(s, 'expression')) {
                if (s.expression.expr.length > 0) {
                    addSentence(parseAssignExpression(s.expression.expr, variables),
                        indent, body);
                }
            } else if (className === 'AstForStatement') {
                _.forEach(s.argument.initStatement.definitions, (d) => {
                    let vn = getVariableName(d.name, variables);
                    addSentence(`=${vn} ${parseExpression(d.value.expr, variables)}`,
                        indent, body);
                });
                addSentence(`while ${parseExpression(s.argument.condition.expr, variables)}`,
                    indent, body);
                let steps = s.argument.step.expr.split(',');
                forStepSentences = _.map(steps, (s: string) =>
                    parseAssignExpression(s.trim(), variables)
                );
            } else if (className === 'AstPrefixStatement') {
                if (s.argument == null || s.argument.expr == null) {
                    addSentence(`${s.name}`, indent, body);
                } else {
                    addSentence(
                        `${s.name} ${parseExpression(s.argument.expr, variables)}`,
                        indent, body);
                }
            } else if (className === 'AstStatementsBlock') {
                let blockBody = parse(s, indent + 1, variables)[0];
                if (blockBody == null) {
                    throw 'invalid block';
                }
                body = body.concat(blockBody);
                if (forStepSentences != null) {
                    _.forEach(forStepSentences, (s) => {
                        addSentence(s, indent + 1, body);
                    });
                    forStepSentences = null;
                }
            }
        });
        let fb = _(body)
            .filter((sentence) => sentence.trim().length > 0)
            .map((sentence) => sentence.split(/[ ]+/).join(' '))
            .value();
        if (indent > 0 || checkBody(fb)) {
            bodies.push(fb);
        }
    } catch (e) {
        console.error(e);
    }
    return bodies;
}

function checkBody(body: string[]) {
    return (_.some(body, (sentence) =>
        _.some(sentence.split(' '), (t) =>
            t.length >= 2 && t.indexOf('/') >= 0
        )
    ));
}

let prevSentence = '';
let prevIndent = 0;
function addSentence(sentence: string, indent: number, body: string[]) {
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
    body.push(_.times(indent, () => '\t').join('') + sentence);
    prevSentence = sentence;
    prevIndent = indent;
}

const assignOps = ['+=', '-=', '*=', '/=', '%=', '++', '--', '='];
function parseAssignExpression(expr: string, currentVariables: string[]) {
    let isAo = false;
    let result: string;
    _.forEach(assignOps, (ao) => {
        var io = expr.indexOf(ao);
        if (io >= 0) {
            let varName = expr.substr(0, io).trim();
            let vn = getVariableName(varName, currentVariables);
            let asExpr = expr.substr(io + ao.length).trim();
            result = `${ao}${vn}`;
            if (asExpr.length > 0) {
                result += ` ${parseExpression(asExpr, currentVariables)}`;
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

const unchangedLiterals = ['0', '1', 'true', ' false'];
const reservedIdentifiers = [
    'HALF_PI', 'PI', 'QUATER_PI', 'TAU', 'TWO_PI',
    'POINTS', 'LINES', 'TRIANGLES', 'TRIANGLE_FAN', 'TRIANGLE_STRIP', 'QUADS', 'QUAD_STRIP',
    'CLOSE',
    'LEFT', 'CENTER', 'RIGHT',
    'THRESHOLD', 'GRAY', 'OPAQUE', 'INVERT', 'POSTERIZE', 'BLUR', 'ERODE', 'DILATE',
    'mouseX', 'mouseY', 'pmouseX', 'pmouseY', 'mouseButton',
    'width', 'height'
];
let globalMembers = ProcessingParser.getGlobalMembers();
let unusedFuncNames = [
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
let changingFuncNames = {
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
            let funcName: string;
            if (_.has(expr.callee, 'object')) {
                funcName = `${expr.callee.object.name}.${expr.callee.property.name}`;
            } else {
                funcName = expr.callee.name;
            }
            if (!(_.has(globalMembers, funcName))) {
                throw `unknown function: ${funcName}`;
            }
            if (_.find(unusedFuncNames, (f) => f === funcName) != null) {
                return '';
            }
            let cf = changingFuncNames[funcName];
            if (cf != null) {
                funcName = cf;
            }
            return _.reduce(expr.arguments, (p, a) => {
                return p + ` ${parseJsepExpression(a, currentVariables)}`;
            }, `${funcName}/${expr.arguments.length}`).trim();
        case 'Literal':
            let ltr = expr.value.toString();
            if (_.find(unchangedLiterals, (ul) => ul === ltr) != null) {
                return ltr;
            } else {
                return _.map(ltr, (c) => (c >= '0' && c <= '9') ? 'D' : c).join('');
            }
        case 'Identifier':
            let idt = expr.name;
            if (_.find(reservedIdentifiers, (ri) => ri === idt) != null) {
                return idt;
            } else {
                return getVariableName(idt, currentVariables);
            }
        case 'BinaryExpression':
        case 'LogicalExpression':
            let l = parseJsepExpression(expr.left, currentVariables);
            let r = parseJsepExpression(expr.right, currentVariables);
            return `${expr.operator} ${l} ${r}`;
        case 'UnaryExpression':
            let a = parseJsepExpression(expr.argument, currentVariables);
            return `${expr.operator} ${a}`;
        default:
            throw `unknown expression: ${JSON.stringify(expr)}`;
    }
}

function getVariableName(name: string, variables: string[]) {
    let vi = _.findIndex(variables, (v) => v === name);
    if (vi >= 0) {
        return `V${vi % maxVariableCount}`;
    } else {
        variables.push(name);
        return `V${(variables.length - 1) % maxVariableCount}`;
    }
}
