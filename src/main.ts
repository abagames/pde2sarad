import * as _ from 'lodash';
import * as fs from 'fs';
import * as path from 'path';
import * as program from 'commander';
import * as parser from './parser';
declare let require: any;
let walk = require('walk');
let process = require('process');

let ProcessingParser: any = {};
let setupParser = require('../web_modules/processing-js/Parser');
setupParser(ProcessingParser);

program
    .version('1.0.0')
    .option('-i --inDir <name>',
    'input pde code dir (default: ./pde_code)', './pde_code')
    .parse(process.argv);
let args = <any>program;
let inDir = args.inDir;

let walker = walk.walk(inDir, { followLinks: false });
let bodies = [];

walker.on('file', (root, fileStat, next) => {
    let fileName = fileStat.name;
    if (_.endsWith(fileName, '.pde')) {
        console.error(`read file name: ${fileName}`);
        fs.readFile(path.resolve(root, fileName),
            { encoding: 'utf8' }, (err, data) => {
                try {
                    let body = parser.parse
                        (ProcessingParser.parseProcessing(data));
                    bodies = bodies.concat(body);
                } catch (e) {
                    console.error(`parse error: ${e}`);
                }
            });
    }
    next();
});

walker.on('errors', (root, nodeStatsArray, next) => {
    console.error(`error:${_.forEach(nodeStatsArray, (n) => {
        return ` ${n.name} ${n.error.message}`;
    })}`)
});

const minOutputLineCount = 2;
walker.on('end', () => {
    console.error('end');
    _.forEach(bodies, (body) => {
        if (body.length >= minOutputLineCount) {
            _.forEach(body, (l) => {
                console.log(l);
            });
            console.log();
        }
    });
});
