import { Playbook } from "./playbook";
import { Step } from "./step";
import { Command } from "./command";
const pegjs = require("pegjs");
const tspegjs = require("ts-pegjs");
const fs = require('fs');


export class Parser {
    private parser;

    constructor() {
        let def = fs.readFileSync(__dirname + "/parser.def", 'utf8');
        this.parser = pegjs.generate(def);
    }

    parse(inputFile: string): Playbook {
        let input = fs.readFileSync(inputFile, 'utf8');
        let parseResult = this.parser.parse(input);
        let result = new Playbook();
        result.title = parseResult[0][2];
        result.subtitle = parseResult[1]? parseResult[1][3]: "";
        result.description = this.insertNewlineIntoDescription(parseResult[2][2].descriptionlines);
        result.conclusion = this.insertNewlineIntoDescription(parseResult[4]? parseResult[4][2].conclusionlines: "");
        for(let index in parseResult[3]){
            let step = new Step();
            step.text = this.getText(parseResult, index);
            step.lines = this.getLines(parseResult, index);
            step.textAfter = this.getTextAfter(parseResult, index);
            step.title = this.getTitle(parseResult, index);
            result.steps.push(step);
        }
        return result;
    }

    getText(parseResult, index){
        try {
            return parseResult[3][index][1].steptextlines || parseResult[3][index][2][1].steptextlines;
        } catch (error) {
            return parseResult[3][index][2][1].steptextlines;
        }
    }

    getLines(parseResult, index):Command[]{
        let linebreak = process.platform=="win32" ? "\r\n" : "\n";
        try {
            return (parseResult[3][index][7].steplines || parseResult[3][index][2][7].steplines).split(linebreak).filter(e => e.trim() != '').map(e => this.createCommand(e));
        } catch (error) {
            return parseResult[3][index][2][7].steplines.split(linebreak).filter(e => e.trim() != '').map(e => this.createCommand(e));
        }
    }

    getTitle(parseResult, index) {
        try {
            // parseResult[3][index][4][2] step without block
            // parseResult[3][index][2][4][2] step inside a block
            return (parseResult[3][index][4][2].steptitle || parseResult[3][index][2][4][2].steptitle);
        } catch(error) {
            return null;
        }
    }

    createCommand(line: string): Command{
        let re =/([^(]+)\(([^)]*)\)/;
        try {
            let result = re.exec(line);
            let retVal = new Command();
            retVal.name = result[1].trim();
            retVal.parameterString = result[2];
            return retVal;
        } catch(e) {
            console.error("Error in method createCommand while parsing line: '" + line + "'");
            throw e;
        }
    }

    getTextAfter(parseResult, index){
        try {
            return parseResult[3][index][3].steptextafterlines || "";
        } catch (error) {
            return "";
        }
    }

    insertNewlineIntoDescription(description: string): string{
        let result = description;
        let offset = 0;
        for(let i = 0; i < description.length-1; i++){
            if(description[i] == '#' && description[i+1] == '#' && description[i+2] == '#'){
                let temp = result.slice(0,i+offset);
                result = temp +"\n"+result.slice(i+offset);
                offset++;
            }
            if(description[i] == '*'){
                let temp = result.slice(0,i+offset);
                result = temp +"\n"+result.slice(i+offset);
                offset++;
            }

        }
        return result;
    }
}
