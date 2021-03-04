import { Runner } from "../../engine/runner"
import { RunResult } from "../../engine/run_result";
import { Playbook } from "../../engine/playbook";
import { RunCommand } from "../../engine/run_command";
import { KatacodaTools } from "./katacodaTools";
import { KatacodaStep, KatacodaSetupScript, KatacodaTerminals } from "./katacodaInterfaces";
import { KatacodaAssetManager } from "./katacodaAssetManager";
import { DirUtils } from "./dirUtils";
import * as path from 'path';
import * as ejs from 'ejs';
import * as fs from 'fs';

export class Katacoda extends Runner {

    private outputPathTutorial: string;
    private tempPath: string;
    private tempPathTutorial: string;
    private stepsCount = 1;
    private steps: KatacodaStep[] = [];
    private setupScripts: KatacodaSetupScript[] = [];
    private assetManager: KatacodaAssetManager;
    private setupDir: string;
    private currentDir: string = path.join("/root");
    private terminalCounter: number = 1;
    private terminals: KatacodaTerminals[] = [{function: "default", terminalId: 1}];
 
    init(playbook: Playbook): void {
        // create directory for katacoda tutorials if not exist
        this.createFolder(path.join(this.getOutputDirectory(), "katacoda/"), false)

        // delete and rebuild directory for tutorial
        this.outputPathTutorial = path.join(this.getOutputDirectory(), "katacoda/", playbook.name);
        this.createFolder(this.outputPathTutorial, true);

        // if general temp directory does not exist create it
        this.tempPath = path.join(this.getTempDirectory(), "katacoda/");
        this.createFolder(this.tempPath, false);

        // delete and rebuild temp directory for this tutorial
        this.tempPathTutorial = path.join(this.tempPath, playbook.name);
        this.createFolder(this.tempPathTutorial, true);

        // create folder for setup scripts inside the temp directory
        this.setupDir = path.join(this.tempPathTutorial, "setup");
        this.createFolder(this.setupDir, false);

        //set working direktory
        this.setVariable(this.workspaceDirectory, path.join("/root"));

        this.assetManager = new KatacodaAssetManager(path.join(this.outputPathTutorial, "assets"));
    }

    destroy(playbook: Playbook): void {
        fs.writeFileSync(this.outputPathTutorial + 'intro.md', playbook.description);
        fs.writeFileSync(this.outputPathTutorial + 'finish.md', "");

        // create and configure required files for the setup process
        this.renderTemplate(path.join("scripts", "intro_foreground.sh"), path.join(this.outputPathTutorial, "intro_foreground.sh"), { });
        this.renderTemplate(path.join("scripts", "intro_background.sh"), path.join(this.outputPathTutorial, "intro_background.sh"), { });
        this.renderTemplate(path.join("scripts", "setup.sh"), path.join(this.tempPathTutorial, "setup", "setup.sh"), {});
        
        this.createFolder(path.join(this.outputPathTutorial, "assets", "setup"), true);
        this.writeSetupFile(path.join(this.outputPathTutorial, "assets", "setup", "setup.txt"))

        // copy all assets from temp/setup in assets folder
        this.assetManager.registerDirectory(path.join(this.tempPathTutorial, "setup"), "setup", "/root/setup", true);
        this.assetManager.copyAssets();

        // write index file, required for katacoda to load the tutorial
        let indexJsonObject = KatacodaTools.generateIndexJson(playbook.title, ((this.stepsCount) * 5), this.steps, this.assetManager.getKatacodaAssets());
        fs.writeFileSync(this.outputPathTutorial + 'index.json', JSON.stringify(indexJsonObject, null, 2));
    }

    runInstallDevonfwIde(runCommand: RunCommand): RunResult {
        let cdCommand = this.changeCurrentDir(path.join("/root"));     
        let tools = runCommand.command.parameters[0].join(" ").replace(/vscode/,"").replace(/eclipse/, "").trim();

        // create script to download devonfw ide settings
        this.renderTemplate(path.join("scripts", "cloneDevonfwIdeSettings.sh"), path.join(this.setupDir, "cloneDevonfwIdeSettings.sh"), { tools: tools, cloneDir: "/root/devonfw-settings/"});

        // add the script to the setup scripts for executing it at the beginning of the tutorial
        this.setupScripts.push({
            "name": "Clone devonfw IDE settings",
            "script": "cloneDevonfwIdeSettings.sh"
        });

        this.pushStep(runCommand, "Install devonfw IDE", "step" + this.getStepsCount(runCommand) + ".md");
        
        this.renderTemplate("installDevonfwIde.md", this.outputPathTutorial + "step" + this.stepsCount + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, cdCommand: cdCommand});
        
        //update current and working directory
        this.currentDir = path.join(this.currentDir, "devonfw");
        this.setVariable(this.workspaceDirectory, path.join("/root", "devonfw", "workspaces", "main"));
        this.setVariable(this.useDevonCommand, true);

        fs.appendFileSync(path.join(this.getRunnerDirectory(),"templates","scripts", "intro_foreground.sh"), "\nexport NG_CLI_ANALYTICS=CI");
        fs.appendFileSync(path.join(this.getRunnerDirectory(),"templates","scripts", "intro_background.sh"), "\necho \'export NG_CLI_ANALYTICS=CI\' >> /root/.profile\n");

        return null;
    }

    runRestoreDevonfwIde(runCommand: RunCommand): RunResult {
        let tools = runCommand.command.parameters[0].join(" ").replace(/vscode/,"").replace(/eclipse/, "").trim();

        // create script to download devonfw ide settings.
        this.renderTemplate(path.join("scripts", "cloneDevonfwIdeSettings.sh"), path.join(this.setupDir, "cloneDevonfwIdeSettings.sh"), { tools: tools, cloneDir: "/root/devonfw-settings/"});
        this.renderTemplate(path.join("scripts", "restoreDevonfwIde.sh"), path.join(this.setupDir, "restoreDevonfwIde.sh"), {});

        // add the script to the setup scripts for executing it at the beginning of the tutorial
        this.setupScripts.push({
            "name": "Clone devonfw IDE settings",
            "script": "cloneDevonfwIdeSettings.sh"
        });
        this.setupScripts.push({
            "name": "Restore Devonfw IDE",
            "script": "restoreDevonfwIde.sh"
        });

        //update working directory
        this.setVariable(this.workspaceDirectory, path.join("/root", "devonfw", "workspaces", "main"));
        this.setVariable(this.useDevonCommand, true);

        fs.appendFileSync(path.join(this.getRunnerDirectory(),"templates","scripts", "intro_foreground.sh"), "\n. ~/.bashrc\nexport NG_CLI_ANALYTICS=CI");
        fs.appendFileSync(path.join(this.getRunnerDirectory(),"templates","scripts", "intro_background.sh"), "\necho \'export NG_CLI_ANALYTICS=CI\' >> /root/.profile\n");

        return null;
    }

    runInstallCobiGen(runCommand: RunCommand): RunResult {
        this.pushStep(runCommand, "Install CobiGen", "step" + this.getStepsCount(runCommand) + ".md");
        
        this.renderTemplate("installCobiGen.md", this.outputPathTutorial + "step" + this.stepsCount + ".md", { text: runCommand.text, textAfter: runCommand.textAfter});
        return null;
    }

    runCobiGenJava(runCommand: RunCommand): RunResult {
        let params = runCommand.command.parameters;
        let cobiGenTemplates = params[1].join(",");

        this.renderTemplate(path.join("scripts", "installCobiGenPlugin.sh"), path.join(this.setupDir, "installCobiGenPlugin.sh"), { });
        this.setupScripts.push({
            "name": "Install CobiGen plugin",
            "script": "installCobiGenPlugin.sh"
        });
        this.pushStep(runCommand, "CobiGen Java", "step" + this.getStepsCount(runCommand) + ".md");
        
        this.renderTemplate("cobiGenJava.md", this.outputPathTutorial + "step" + this.stepsCount + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, javaFile: params[0], cobiGenTemplates: cobiGenTemplates });
        return null;

    }

    runCreateDevon4jProject(runCommand: RunCommand): RunResult {

        // generate template to change directory, if the current directory is not equal to the required start directory
       let cdCommand = this.changeCurrentDir(path.join("/root", "devonfw", "workspaces", "main"));

       this.pushStep(runCommand, "Create a new project", "step" + this.getStepsCount(runCommand) + ".md");

       this.renderTemplate("createDevon4jProject.md", this.outputPathTutorial + "step" + this.stepsCount + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, cdCommand: cdCommand, name : runCommand.command.parameters[0]});
       return null;  
    }

    runCreateFile(runCommand: RunCommand): RunResult{
        let workspaceDir = path.join(this.getVariable(this.workspaceDirectory).concat(path.sep).replace(path.sep + "root" + path.sep, ""));
        let filePath = path.join(this.getVariable(this.workspaceDirectory), path.dirname(runCommand.command.parameters[0])).replace(/\\/g, "/");
        let fileDir = path.join(workspaceDir, runCommand.command.parameters[0]).replace(/\\/g, "/");
        let fileName = path.basename(path.join(runCommand.command.parameters[0]));
        let content = "";
        if(runCommand.command.parameters.length == 2) {
            content = fs.readFileSync(path.join(this.playbookPath, runCommand.command.parameters[1]), { encoding: "utf-8" });
        }
        this.pushStep(runCommand, "Create a new file", "step" + this.getStepsCount(runCommand) + ".md");
        
        this.renderTemplate("createFile.md", this.outputPathTutorial + "step" + this.stepsCount + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, filePath: filePath, fileDir: fileDir , fileName:fileName , content: content});
        return null;
    }

    runChangeFile(runCommand: RunCommand): RunResult{
        let workspaceDir = path.join(this.getVariable(this.workspaceDirectory).concat(path.sep).replace(path.sep + "root" + path.sep, ""));
        let fileName = path.basename(path.join(runCommand.command.parameters[0]));
        let fileDir = path.join(workspaceDir, runCommand.command.parameters[0]).replace(/\\/g, "/");
        let placeholder = runCommand.command.parameters[1].placeholder ? runCommand.command.parameters[1].placeholder : "";
        let dataTarget = runCommand.command.parameters[1].placeholder ? "insert" : "replace";

        let content = "";
        if(runCommand.command.parameters[1].content || runCommand.command.parameters[1].contentKatacoda){
            content = (runCommand.command.parameters[1].contentKatacoda) ? runCommand.command.parameters[1].contentKatacoda : runCommand.command.parameters[1].content;
        }else if(runCommand.command.parameters[1].file || runCommand.command.parameters[1].fileKatacoda){
            let file = (runCommand.command.parameters[1].fileKatacoda) ? runCommand.command.parameters[1].fileKatacoda : runCommand.command.parameters[1].file;
            content = fs.readFileSync(path.join(this.playbookPath, file), { encoding: "utf-8" });
        }

        this.pushStep(runCommand, "Change " + fileName, "step" + this.getStepsCount(runCommand) + ".md");
        
        this.renderTemplate("changeFile.md", this.outputPathTutorial + "step" + this.stepsCount + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, fileDir: fileDir, content: content, placeholder: placeholder, dataTarget: dataTarget });
        return null;
    }

    runBuildJava(runCommand: RunCommand): RunResult{
        
        let cdCommand = this.changeCurrentDir(path.join(this.getVariable(this.workspaceDirectory), runCommand.command.parameters[0]));
        let skipTest = (runCommand.command.parameters.length == 2 && runCommand.command.parameters[1] == true) ? false : true;
    
        this.pushStep(runCommand, "Build the java project", "step" + this.getStepsCount(runCommand) + ".md");
        
        this.renderTemplate("buildJava.md", this.outputPathTutorial + "step" + this.stepsCount + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, cdCommand: cdCommand, skipTest: skipTest, useDevonCommand: this.getVariable(this.useDevonCommand)});
        return null;

    }


    runBuildNg(runCommand: RunCommand): RunResult {
        let cdCommand = this.changeCurrentDir(path.join(this.getVariable(this.workspaceDirectory), runCommand.command.parameters[0]));

        this.pushStep(runCommand, "Build the Angular Project", "step" + this.getStepsCount(runCommand) + ".md");

        this.renderTemplate("buildNg.md", this.outputPathTutorial + "step" + this.stepsCount + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, cdCommand: cdCommand, outputDir: runCommand.command.parameters[1], useDevonCommand: this.getVariable(this.useDevonCommand) });

        return null;
    }
  
    runCloneRepository(runCommand: RunCommand): RunResult {

        let cdCommand = this.changeCurrentDir(path.join(this.getVariable(this.workspaceDirectory)));
        let directoryPath = "";
        if(runCommand.command.parameters[0].trim()) {
            directoryPath = path.join(runCommand.command.parameters[0]).replace(/\\/g, "/");
            this.currentDir = path.join(this.currentDir, directoryPath);
        }
        
        this.pushStep(runCommand, "Clones Repository " + runCommand.command.parameters[1], "step" + this.getStepsCount(runCommand) + ".md");

        this.renderTemplate("cloneRepository.md", this.outputPathTutorial + "step" + this.stepsCount + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, cdCommand: cdCommand, directoryPath: directoryPath, repository: runCommand.command.parameters[1] });
        return null;
    }

    runRunServerJava(runCommand: RunCommand): RunResult{
        let serverDir = path.join(this.getVariable(this.workspaceDirectory), runCommand.command.parameters[0]);
        let terminal = this.getTerminal('runServerJava');
        let cdCommand = this.changeCurrentDir(serverDir, terminal.terminalId, terminal.isRunning);
        this.pushStep(runCommand, "Start the java server", "step" + this.getStepsCount(runCommand) + ".md");
        
        this.renderTemplate("runServerJava.md", this.outputPathTutorial + "step" + this.stepsCount + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, cdCommand: cdCommand, terminalId: terminal.terminalId, interrupt: terminal.isRunning, useDevonCommand: this.getVariable(this.useDevonCommand)});
        return null;
    }

    runNpmInstall(runCommand: RunCommand): RunResult {
        let cdCommand = this.changeCurrentDir(path.join(this.getVariable(this.workspaceDirectory), runCommand.command.parameters[0]));
        let packageTitle = (runCommand.command.parameters.length > 1 && runCommand.command.parameters[1].name) ? runCommand.command.parameters[1].name : "the dependencies";
        let npmCommand = {
            "name": (runCommand.command.parameters.length > 1 && runCommand.command.parameters[1].name) ? runCommand.command.parameters[1].name : undefined,
            "global": (runCommand.command.parameters.length > 1 && runCommand.command.parameters[1].global) ? runCommand.command.parameters[1].global : false, 
            "args": (runCommand.command.parameters.length > 1 && runCommand.command.parameters[1].args) ? runCommand.command.parameters[1].args.join(" ") : undefined
        };

        this.steps.push({
            "title": "Install " + packageTitle,
            "text": "step" + this.stepsCount + ".md"
        });
        this.renderTemplate("npmInstall.md", this.outputPathTutorial + "step" + (this.stepsCount++) + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, cdCommand: cdCommand, useDevonCommand: this.getVariable(this.useDevonCommand), npmCommand: npmCommand});
        return null;
    }

    runRunClientNg(runCommand: RunCommand): RunResult {
        let serverDir = path.join(this.getVariable(this.workspaceDirectory), runCommand.command.parameters[0]);
        let terminal = this.getTerminal('runClientNg');
        let cdCommand = this.changeCurrentDir(serverDir, terminal.terminalId, terminal.isRunning);

        this.pushStep(runCommand, "Start the Angular Project", "step" + this.getStepsCount(runCommand) + ".md");

        fs.appendFileSync(path.join(this.getRunnerDirectory(),"templates","scripts", "intro_background.sh"), "\necho \'export NODE_OPTIONS=\"--max-old-space-size=16384\"\' >> /root/.profile\n");

        this.renderTemplate("runClientNg.md", this.outputPathTutorial + "step" + this.stepsCount + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, cdCommand: cdCommand, terminalId: terminal.terminalId, interrupt: terminal.isRunning, port: runCommand.command.parameters[1].port, useDevonCommand: this.getVariable(this.useDevonCommand)});
        return null;
    }

    runCreateFolder(runCommand: RunCommand): RunResult {
        let folderPath = new DirUtils().getCdParam(this.currentDir, path.join(this.getVariable(this.workspaceDirectory), runCommand.command.parameters[0]));

        this.pushStep(runCommand, "Create a new folder", "step" + this.getStepsCount(runCommand) + ".md");
        
        this.renderTemplate("createFolder.md", this.outputPathTutorial + "step" + this.stepsCount + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, folderPath: folderPath });
        return null;
    }

    runNextKatacodaStep(runCommand: RunCommand): RunResult {
        let tempFile = path.join(this.getTempDirectory(), runCommand.command.name + ".md");
        fs.writeFileSync(tempFile, "");
        for(let i = 0; i < runCommand.command.parameters[1].length; i++) {
            let param = runCommand.command.parameters[1][i];
            if(param.content) {
                fs.appendFileSync(tempFile, param.content);
            } else if(param.file) {
                fs.appendFileSync(tempFile, fs.readFileSync(path.join(this.playbookPath, param.file), "utf-8"));
            } else if (param.image) {
                let image = path.join(this.playbookPath, param.image);
                this.assetManager.registerFile(image, path.basename(image), "", true);
                fs.appendFileSync(tempFile, "![" + path.basename(image) + "](./assets/" + path.basename(image) + ")");
            }
            fs.appendFileSync(tempFile, "\n\n");
        }

        let content = fs.readFileSync(tempFile, "utf-8");
        this.pushStep(runCommand, runCommand.command.parameters[0], "step" + this.getStepsCount(runCommand) + ".md");

        this.renderTemplate("nextKatacodaStep.md", this.outputPathTutorial + "step" + this.stepsCount + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, content: content });
        
        if(runCommand.command.parameters[2]) {
            this.currentDir = path.join(this.getVariable(this.workspaceDirectory), runCommand.command.parameters[2]);
        }
        
        return null;
    }

    runAdaptTemplatesCobiGen(runCommand: RunCommand): RunResult {
        this.pushStep(runCommand, "Adapt cobiGen templates", "step" + this.getStepsCount(runCommand) + ".md");
        
        this.renderTemplate("adaptTemplatesCobiGen.md", this.outputPathTutorial + "step" + this.stepsCount + ".md", { text: runCommand.text, textAfter: runCommand.textAfter});
 
        return null;
    }

    runDockerCompose(runCommand: RunCommand) : RunResult {
        let terminal = this.getTerminal('runDockerCompose');
        let cdCommand = this.changeCurrentDir(path.join(this.getVariable(this.workspaceDirectory), runCommand.command.parameters[0]), terminal.terminalId, terminal.isRunning);

        this.pushStep(runCommand, "Execute Docker Compose", "step" + this.getStepsCount(runCommand) + ".md");

        this.renderTemplate("dockerCompose.md", this.outputPathTutorial + "step" + this.stepsCount + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, cdCommand: cdCommand, terminalId: terminal.terminalId, interrupt: terminal.isRunning, port: runCommand.command.parameters[1].port});
        return null;

    }

    runExecuteFile(step: Step, command: Command) : RunResult {
        let fileDir = path.join(this.getVariable(this.workspaceDirectory), path.dirname(command.parameters[0]));

        let terminal = (command.parameters.length > 1 && command.parameters[1].asynchronous) 
            ? this.getTerminal('executeFile') 
            : undefined;

        let cdCommand = (command.parameters.length > 1 && command.parameters[1].asynchronous) 
        ? this.changeCurrentDir(fileDir, terminal.terminalId, terminal.isRunning)
        : this.changeCurrentDir(fileDir);

        let bashCommand = {
            "name" : path.basename(command.parameters[0]),
            "terminalId" : terminal ? terminal.terminalId : 1,
            "interrupt" : terminal ?  terminal.isRunning : false,
            "args": (command.parameters.length > 1 && command.parameters[1].args) ? command.parameters[1].args.join(" ") : undefined
        }
        
        this.steps.push({
            "title": "Execute " + path.basename(command.parameters[0]),
            "text": "step" +this.stepsCount + ".md"
        });

        this.renderTemplate("executeFile.md", this.outputPathTutorial + "step" + (this.stepsCount++) + ".md", { text: step.text, textAfter: step.textAfter, cdCommand: cdCommand, bashCommand: bashCommand});
        return null;

    }


    private renderTemplate(name: string, targetPath: string, variables) {
        let template = fs.readFileSync(path.join(this.getRunnerDirectory(),"templates", name), 'utf8');
        let result = ejs.render(template, variables);
        fs.writeFileSync(targetPath, result, {flag: "a"});
    }

    private writeSetupFile(setupFile: string) {
        fs.writeFileSync(setupFile, this.setupScripts.length + "\n\n");
        for(let i = 0; i < this.setupScripts.length; i++) {
            fs.appendFileSync(setupFile, this.setupScripts[i].name + "\n");
            fs.appendFileSync(setupFile, this.setupScripts[i].script + "\n");
            fs.appendFileSync(setupFile, "##########\n");
        }

        this.assetManager.registerFile(setupFile, "setup/setup.txt", "/root/setup", false);
    }

    private changeCurrentDir(targetDir:string, terminalId?: number, isRunning?: boolean):string{
        if(!terminalId && this.currentDir == targetDir || isRunning){
            return "";
        }
        let dirUtils = new DirUtils();
        let dir = terminalId ? dirUtils.getCdParam(path.join("/root"), targetDir) : dirUtils.getCdParam(this.currentDir, targetDir);
        let terminal = terminalId ? "T" + terminalId : "T1";
           
        if(!terminalId){
            this.currentDir = targetDir;
        }
        
        //create template to change directory 
        let template = fs.readFileSync(path.join(this.getRunnerDirectory(),"templates", 'cd.md'), 'utf8');
        return ejs.render(template, {dir: dir, terminal: terminal, terminalId: terminalId}); 
    }

    private getTerminal(functionName: string): {terminalId:number, isRunning:boolean}{
        let terminal = this.terminals.find( terminal => terminal.function === functionName)
        if(terminal){
            return {terminalId: terminal.terminalId, isRunning: true};
        } 
        this.terminalCounter++;
        this.terminals.push({function: functionName, terminalId: this.terminalCounter});
        return {terminalId: this.terminalCounter, isRunning: false};
    }

    private getStepsCount(runCommand: RunCommand): number {
        let returnCount = runCommand.stepIndex == this.stepsCount - 1 ? this.stepsCount : ++this.stepsCount;
        return returnCount;
    }

    private pushStep(runCommand: RunCommand, title: string, text: string) {
        if (this.steps.length == this.stepsCount - 1) {
            let stepTitle = runCommand.stepTitle ? runCommand.stepTitle : title;
            this.steps.push({
                "title": stepTitle,
                "text": text
            }); 
        }
    }

}