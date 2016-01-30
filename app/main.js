var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var program = require('commander');
var parser = require('./parser');
var walk = require('walk');
var process = require('process');
var ProcessingParser = {};
var setupParser = require('../web_modules/processing-js/Parser');
setupParser(ProcessingParser);
program
    .version('1.0.0')
    .option('-i --inDir <name>', 'input pde code dir (default: ./pde_code)', './pde_code')
    .parse(process.argv);
var args = program;
var inDir = args.inDir;
//*
var walker = walk.walk(inDir, { followLinks: false });
var bodies = [];
walker.on('file', function (root, fileStat, next) {
    var fileName = fileStat.name;
    if (_.endsWith(fileName, '.pde')) {
        console.error("read file name: " + fileName);
        fs.readFile(path.resolve(root, fileName), { encoding: 'utf8' }, function (err, data) {
            try {
                var body = parser.parse(ProcessingParser.parseProcessing(data));
                bodies = bodies.concat(body);
            }
            catch (e) {
                console.error("parse error: " + e);
            }
        });
    }
    next();
});
walker.on('errors', function (root, nodeStatsArray, next) {
    console.error("error:" + _.forEach(nodeStatsArray, function (n) {
        return " " + n.name + " " + n.error.message;
    }));
});
var minOutputLineCount = 2;
walker.on('end', function () {
    console.error('end');
    _.forEach(bodies, function (body) {
        if (body.length >= minOutputLineCount) {
            _.forEach(body, function (l) {
                console.log(l);
            });
            console.log();
        }
    });
});
/*/
let prcCode = ProcessingParser.parseProcessing(`
void draw() {
    int x = 0;
    for (int i = 1; i < 20; i++, j--) {
        x += 3;
        line(10, 10, 20, 20);
    }
    while (x > 0) {
        x++;
    }
    background(10);
}

void star() {
    line(10, 10, 20, 20);
    return 5;
}
`);
//console.log(prcCode);
let code = parser.parse(prcCode);
_.forEach(code, (c) => console.log(c));
//*/ 
//# sourceMappingURL=main.js.map