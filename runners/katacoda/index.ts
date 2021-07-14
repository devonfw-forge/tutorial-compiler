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
import { Converter } from "../../engine/converter";
import { Assertions } from "../../assertions";

export class Katacoda extends Runner {

    private outputPathTutorial: string;
    private tempPath: string;
    private tempPathTutorial: string;
    private currentStepIndex = -1;
    private steps: KatacodaStep[] = [];
    private setupScripts: KatacodaSetupScript[] = [];
    private assetManager: KatacodaAssetManager;
    private setupDir: string;
    private currentDir: string = path.join("/root");
    private terminalCounter: number = 1;
    private showVsCodeIde: boolean = false;
    private terminals: KatacodaTerminals[] = [{function: "default", terminalId: 1}];
    private converter: Converter;
 
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
        this.setVariable(this.WORKSPACE_DIRECTORY, path.join("/root"));

        this.converter = new Converter();

        this.assetManager = new KatacodaAssetManager(path.join(this.outputPathTutorial, "assets"));
        
        playbook.steps.forEach(step => {
            step.lines.forEach(stepLine => {
                if((stepLine.name == "installDevonfwIde" || stepLine.name == "restoreDevonfwIde") && stepLine.parameters[0].indexOf("vscode") > -1) {
                    this.showVsCodeIde = true;
                }
            });
        });
    }

    async destroy(playbook: Playbook): Promise<void> {
        let tutorialDirectoryName = path.basename(playbook.path);
        this.renderTemplate("intro.md", path.join(this.outputPathTutorial, "intro.md"), { description: this.converter.convertAsciidocToMarkdown(playbook.description), tutorialPath: tutorialDirectoryName });
        fs.writeFileSync(this.outputPathTutorial + 'finish.md', this.converter.convertAsciidocToMarkdown(playbook.conclusion));

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
        let indexJsonObject = KatacodaTools.generateIndexJson(playbook.title, playbook.subtitle, ((playbook.steps.length) * 5), this.steps, this.assetManager.getKatacodaAssets(), this.showVsCodeIde);
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

        this.pushStep(runCommand, "Install devonfw IDE", "step" + runCommand.stepIndex + ".md");
        
        this.renderTemplate("installDevonfwIde.md", this.outputPathTutorial + "step" + runCommand.stepIndex + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, cdCommand: cdCommand, tools: tools});
        
        //update current and working directory
        this.currentDir = path.join(this.currentDir, "devonfw");
        this.setVariable(this.WORKSPACE_DIRECTORY, path.join("/root", "devonfw", "workspaces", "main"));
        this.setVariable(this.USE_DEVON_COMMAND, true);

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
            "name": "Restore devonfw IDE",
            "script": "restoreDevonfwIde.sh"
        });
        //update working directory
        this.setVariable(this.WORKSPACE_DIRECTORY, path.join("/root", "devonfw", "workspaces", "main"));
        this.setVariable(this.USE_DEVON_COMMAND, true);

        fs.appendFileSync(path.join(this.getRunnerDirectory(),"templates","scripts", "intro_foreground.sh"), "\n. ~/.bashrc\nexport NG_CLI_ANALYTICS=CI");
        fs.appendFileSync(path.join(this.getRunnerDirectory(),"templates","scripts", "intro_background.sh"), "\necho \'export NG_CLI_ANALYTICS=CI\' >> /root/.profile\n");

        this.pushStep(runCommand);
        return null;
    }

    runRestoreWorkspace(runCommand: RunCommand): RunResult {
        let workspacesName = "workspace-" + ((runCommand.command.parameters.length > 0 && runCommand.command.parameters[0].workspace)
            ? runCommand.command.parameters[0].workspace
            : this.playbookName.replace("/", "").replace(" ","-"));

        let workspacesDir = this.getVariable(this.USE_DEVON_COMMAND)
            ? path.join('/root', "devonfw", "workspaces").replace(/\\/g, "/")
            : path.join('/root', "workspaces").replace(/\\/g, "/");

        let user = this.getVariable('user') ? this.getVariable('user') : 'devonfw-tutorials';
        this.renderTemplate(path.join("scripts", "restoreWorkspace.sh"), path.join(this.setupDir, "restoreWorkspace.sh"), {user: user, branch: this.getVariable("branch"), workspace: workspacesName, workspaceDir: workspacesDir, useDevonCommand: !!this.getVariable(this.USE_DEVON_COMMAND)});
        
        this.setupScripts.push({
            "name": "Restore Workspace",
            "script": "restoreWorkspace.sh"
        });

        if(!this.getVariable(this.USE_DEVON_COMMAND))
            this.setVariable(this.WORKSPACE_DIRECTORY, path.join('/root', "workspaces"));

        this.pushStep(runCommand);
        return null;
    }

    runInstallCobiGen(runCommand: RunCommand): RunResult {
        this.pushStep(runCommand, "Install CobiGen", "step" + runCommand.stepIndex + ".md");
        
        this.renderTemplate("installCobiGen.md", this.outputPathTutorial + "step" + runCommand.stepIndex + ".md", { text: runCommand.text, textAfter: runCommand.textAfter});
        return null;
    }

    runCobiGenJava(runCommand: RunCommand): RunResult {
        let params = runCommand.command.parameters;
        let cobiGenTemplates = params[1].join(",");

        if(this.showVsCodeIde) {
            this.renderTemplate(path.join("scripts", "installCobiGenPlugin.sh"), path.join(this.setupDir, "installCobiGenPlugin.sh"), { });
            this.setupScripts.push({
                "name": "Install CobiGen plugin",
                "script": "installCobiGenPlugin.sh"
            });
        }

        this.pushStep(runCommand, "CobiGen Java", "step" + runCommand.stepIndex + ".md");
        this.renderTemplate("cobiGenJava.md", this.outputPathTutorial + "step" + runCommand.stepIndex + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, javaFile: params[0], cobiGenTemplates: cobiGenTemplates, useVsCode: this.showVsCodeIde });
        return null;

    }

    runCreateDevon4jProject(runCommand: RunCommand): RunResult {

        // generate template to change directory, if the current directory is not equal to the required start directory
       let cdCommand = this.changeCurrentDir(path.join("/root", "devonfw", "workspaces", "main"));

       this.pushStep(runCommand, "Create a new project", "step" + runCommand.stepIndex + ".md");

       this.renderTemplate("createDevon4jProject.md", this.outputPathTutorial + "step" + runCommand.stepIndex + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, cdCommand: cdCommand, name : runCommand.command.parameters[0]});
       return null;  
    }

    runCreateFile(runCommand: RunCommand): RunResult{
        let workspaceDir = path.join(this.getVariable(this.WORKSPACE_DIRECTORY).concat(path.sep).replace(path.sep + "root" + path.sep, ""));
        let filePath = path.join(this.getVariable(this.WORKSPACE_DIRECTORY), path.dirname(runCommand.command.parameters[0])).replace(/\\/g, "/");
        let fileDir = path.join(workspaceDir, runCommand.command.parameters[0]).replace(/\\/g, "/");
        let fileName = path.basename(path.join(runCommand.command.parameters[0]));
        let content = "";
        if(runCommand.command.parameters.length == 2) {
            content = fs.readFileSync(path.join(this.playbookPath, runCommand.command.parameters[1]), { encoding: "utf-8" });
        }
        this.pushStep(runCommand, "Create a new file", "step" + runCommand.stepIndex + ".md");
        
        this.renderTemplate("createFile.md", this.outputPathTutorial + "step" + runCommand.stepIndex + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, filePath: filePath, fileDir: fileDir , fileName:fileName , content: content});           
        return null;
    }

    runChangeFile(runCommand: RunCommand): RunResult{
        let workspaceDir = path.join(this.getVariable(this.WORKSPACE_DIRECTORY).concat(path.sep).replace(path.sep + "root" + path.sep, ""));
        let fileName = path.basename(path.join(runCommand.command.parameters[0]));
        let fileDir = path.relative('/root', path.join(this.getVariable(this.WORKSPACE_DIRECTORY), runCommand.command.parameters[0])).replace(/\\/g, "/");
        let placeholder = runCommand.command.parameters[1].placeholder ? runCommand.command.parameters[1].placeholder : "";
        let dataTarget = runCommand.command.parameters[1].placeholder ? "insert" : "replace";
        let content = "";
        let lineInsert= false;
        if(runCommand.command.parameters[1].lineNumber){
            let number = parseInt(runCommand.command.parameters[1].lineNumber);
            let numberStr = (number == 1) ? (number.toString()+"i") : ((number-1).toString()+"a");

            this.renderTemplate(path.join("scripts", "insert_background.sh"), path.join(this.outputPathTutorial, "insert_background"+runCommand.stepIndex+".sh"), { lineNumber: numberStr, filename: fileDir});
            this.renderTemplate(path.join("scripts", "insert_foreground.sh"), path.join(this.outputPathTutorial, "insert_foreground"+runCommand.stepIndex+".sh"), { filename: fileDir, lineNumber: runCommand.command.parameters[1].lineNumber });

            placeholder = "##PLACEHOLDER##";
            dataTarget = "insert";
            lineInsert = true;
        }
        
        if(runCommand.command.parameters[1].content || runCommand.command.parameters[1].contentKatacoda){
            content = (runCommand.command.parameters[1].contentKatacoda) ? runCommand.command.parameters[1].contentKatacoda : runCommand.command.parameters[1].content;
        }else if(runCommand.command.parameters[1].file || runCommand.command.parameters[1].fileKatacoda){
            let file = (runCommand.command.parameters[1].fileKatacoda) ? runCommand.command.parameters[1].fileKatacoda : runCommand.command.parameters[1].file;
            content = fs.readFileSync(path.join(this.playbookPath, file), { encoding: "utf-8" });
        }

        if(runCommand.command.parameters[1].lineNumber){
            this.pushStep(runCommand, "Change " + fileName, "step" + runCommand.stepIndex + ".md", "insert_background"+runCommand.stepIndex+".sh", "insert_foreground"+runCommand.stepIndex+".sh");
        }else{
            this.pushStep(runCommand, "Change " + fileName, "step" + runCommand.stepIndex + ".md");
        }
        this.renderTemplate("changeFile.md", this.outputPathTutorial + "step" + runCommand.stepIndex + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, fileDir: fileDir, content: content, placeholder: placeholder, dataTarget: dataTarget, lineInsert: lineInsert});
        return null;
    }

    runBuildJava(runCommand: RunCommand): RunResult{
        
        let cdCommand = this.changeCurrentDir(path.join(this.getVariable(this.WORKSPACE_DIRECTORY), runCommand.command.parameters[0]));
        let skipTest = (runCommand.command.parameters.length == 2 && runCommand.command.parameters[1] == true) ? false : true;
    
        this.pushStep(runCommand, "Build the Java project", "step" + runCommand.stepIndex + ".md");
        
        this.renderTemplate("buildJava.md", this.outputPathTutorial + "step" + runCommand.stepIndex + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, cdCommand: cdCommand, skipTest: skipTest, useDevonCommand: this.getVariable(this.USE_DEVON_COMMAND)});
        return null;

    }


    runBuildNg(runCommand: RunCommand): RunResult {
        let cdCommand = this.changeCurrentDir(path.join(this.getVariable(this.WORKSPACE_DIRECTORY), runCommand.command.parameters[0]));

        this.pushStep(runCommand, "Build the Angular project", "step" + runCommand.stepIndex + ".md");

        this.renderTemplate("buildNg.md", this.outputPathTutorial + "step" + runCommand.stepIndex + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, cdCommand: cdCommand, outputDir: runCommand.command.parameters[1], useDevonCommand: this.getVariable(this.USE_DEVON_COMMAND) });

        return null;
    }
  
    runCloneRepository(runCommand: RunCommand): RunResult {

        let cdCommand = this.changeCurrentDir(path.join(this.getVariable(this.WORKSPACE_DIRECTORY)));
        let directoryPath = "";
        if(runCommand.command.parameters[0].trim()) {
            directoryPath = path.join(runCommand.command.parameters[0]).replace(/\\/g, "/");
            this.currentDir = path.join(this.currentDir, directoryPath);
        }
        
        this.pushStep(runCommand, "Clone the repository " + runCommand.command.parameters[1], "step" + runCommand.stepIndex + ".md");

        this.renderTemplate("cloneRepository.md", this.outputPathTutorial + "step" + runCommand.stepIndex + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, cdCommand: cdCommand, directoryPath: directoryPath, repository: runCommand.command.parameters[1] });
        return null;
    }

    runRunServerJava(runCommand: RunCommand): RunResult{
        let serverDir = path.join(this.getVariable(this.WORKSPACE_DIRECTORY), runCommand.command.parameters[0]);
        let terminal = this.getTerminal('runServerJava');
        let cdCommand = this.changeCurrentDir(serverDir, terminal.terminalId, terminal.isRunning);
        this.pushStep(runCommand, "Start the Java server", "step" + runCommand.stepIndex + ".md");
        
        this.renderTemplate("runServerJava.md", this.outputPathTutorial + "step" + runCommand.stepIndex + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, cdCommand: cdCommand, terminalId: terminal.terminalId, interrupt: terminal.isRunning, useDevonCommand: this.getVariable(this.USE_DEVON_COMMAND)});
        return null;
    }

    runNpmInstall(runCommand: RunCommand): RunResult {
        let cdCommand = this.changeCurrentDir(path.join(this.getVariable(this.WORKSPACE_DIRECTORY), runCommand.command.parameters[0]));
        let packageTitle = (runCommand.command.parameters.length > 1 && runCommand.command.parameters[1].name) ? runCommand.command.parameters[1].name : "the dependencies";
        let npmCommand = {
            "name": (runCommand.command.parameters.length > 1 && runCommand.command.parameters[1].name) ? runCommand.command.parameters[1].name : undefined,
            "global": (runCommand.command.parameters.length > 1 && runCommand.command.parameters[1].global) ? runCommand.command.parameters[1].global : false, 
            "args": (runCommand.command.parameters.length > 1 && runCommand.command.parameters[1].args) ? runCommand.command.parameters[1].args.join(" ") : undefined
        };

        this.pushStep(runCommand, "Install " + packageTitle, "step" + runCommand.stepIndex + ".md")
        
        this.renderTemplate("npmInstall.md", this.outputPathTutorial + "step" + runCommand.stepIndex + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, cdCommand: cdCommand, useDevonCommand: this.getVariable(this.USE_DEVON_COMMAND), npmCommand: npmCommand});
        return null;
    }

    runRunClientNg(runCommand: RunCommand): RunResult {
        let serverDir = path.join(this.getVariable(this.WORKSPACE_DIRECTORY), runCommand.command.parameters[0]);
        let terminal = this.getTerminal('runClientNg');
        let cdCommand = this.changeCurrentDir(serverDir, terminal.terminalId, terminal.isRunning);

        this.pushStep(runCommand, "Start the Angular project", "step" + runCommand.stepIndex + ".md");

        fs.appendFileSync(path.join(this.getRunnerDirectory(),"templates","scripts", "intro_background.sh"), "\necho \'export NODE_OPTIONS=\"--max-old-space-size=16384\"\' >> /root/.profile\n");

        this.renderTemplate("runClientNg.md", this.outputPathTutorial + "step" + runCommand.stepIndex + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, cdCommand: cdCommand, terminalId: terminal.terminalId, interrupt: terminal.isRunning, port: runCommand.command.parameters[1].port, useDevonCommand: this.getVariable(this.USE_DEVON_COMMAND)});
        return null;
    }

    runCreateFolder(runCommand: RunCommand): RunResult {
        let folderPath = new DirUtils().getCdParam(this.currentDir, path.join(this.getVariable(this.WORKSPACE_DIRECTORY), runCommand.command.parameters[0]));

        this.pushStep(runCommand, "Create a new folder", "step" + runCommand.stepIndex + ".md");
        
        this.renderTemplate("createFolder.md", this.outputPathTutorial + "step" + runCommand.stepIndex + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, folderPath: folderPath });
        return null;
    }

    runDownloadFile(runCommand: RunCommand): RunResult {
        this.pushStep(runCommand, "Download a file", "step" + runCommand.stepIndex + ".md");

        let downloadDir = this.getVariable(this.WORKSPACE_DIRECTORY).replace(/\\/g, "/")
        if (runCommand.command.parameters.length == 3) {
            downloadDir = downloadDir.concat("/", runCommand.command.parameters[2])
        }
        this.renderTemplate("downloadFile.md", this.outputPathTutorial + "step" + runCommand.stepIndex + ".md", {text: runCommand.text, textAfter: runCommand.textAfter, downloadURL: runCommand.command.parameters[0], downloadDir: downloadDir, downloadFile: runCommand.command.parameters[1]});
        return null;
    }

    runDisplayContent(runCommand: RunCommand): RunResult {
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
        this.pushStep(runCommand, runCommand.command.parameters[0], "step" + runCommand.stepIndex + ".md");

        this.renderTemplate("displayContent.md", this.outputPathTutorial + "step" + runCommand.stepIndex + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, content: content });
        
        if(runCommand.command.parameters[2]) {
            this.currentDir = path.join(this.getVariable(this.WORKSPACE_DIRECTORY), runCommand.command.parameters[2]);
        }
        
        return null;
    }

    runAdaptTemplatesCobiGen(runCommand: RunCommand): RunResult {
        this.pushStep(runCommand, "Adapt CobiGen templates", "step" + runCommand.stepIndex + ".md");
        
        this.renderTemplate("adaptTemplatesCobiGen.md", this.outputPathTutorial + "step" + runCommand.stepIndex + ".md", { text: runCommand.text, textAfter: runCommand.textAfter});
 
        return null;
    }

    runDockerCompose(runCommand: RunCommand) : RunResult {
        let terminal = this.getTerminal('runDockerCompose');
        let cdCommand = this.changeCurrentDir(path.join(this.getVariable(this.WORKSPACE_DIRECTORY), runCommand.command.parameters[0]), terminal.terminalId, terminal.isRunning);

        this.pushStep(runCommand, "Execute Docker Compose", "step" + runCommand.stepIndex + ".md");

        this.renderTemplate("dockerCompose.md", this.outputPathTutorial + "step" + runCommand.stepIndex + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, cdCommand: cdCommand, terminalId: terminal.terminalId, interrupt: terminal.isRunning, port: runCommand.command.parameters[1].port});
        return null;

    }

    runCreateDevon4ngProject(runCommand: RunCommand): RunResult {
        let cdCommand = this.changeCurrentDir(path.join(this.getVariable(this.WORKSPACE_DIRECTORY), runCommand.command.parameters[1]));
        let params = runCommand.command.parameters.length > 2 && (runCommand.command.parameters[2] instanceof Array) ? runCommand.command.parameters[2].join(" ") : "";
        
        this.pushStep(runCommand, "Create Angular project", "step" + runCommand.stepIndex + ".md");

        this.renderTemplate("createDevon4ngProject.md", this.outputPathTutorial + "step" + runCommand.stepIndex + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, cdCommand: cdCommand, projectName: runCommand.command.parameters[0], params: params, useDevonCommand: this.getVariable(this.USE_DEVON_COMMAND) });
        return null;
    }

    runExecuteCommand(runCommand: RunCommand) : RunResult {
        let terminal = (runCommand.command.parameters.length > 2 && runCommand.command.parameters[2].asynchronous) 
            ? this.getTerminal("executeCommand" + runCommand.stepIndex)
            : undefined;

        let cdCommand: string;
        if(runCommand.command.parameters.length > 2 && runCommand.command.parameters[2].dir) {
            cdCommand = terminal 
                ? this.changeCurrentDir(path.join(this.getVariable(this.WORKSPACE_DIRECTORY), runCommand.command.parameters[2].dir), terminal.terminalId, terminal.isRunning)
                : this.changeCurrentDir(path.join(this.getVariable(this.WORKSPACE_DIRECTORY), runCommand.command.parameters[2].dir));
        } else {
            cdCommand = this.changeCurrentDir(path.join(this.getVariable(this.WORKSPACE_DIRECTORY)));
        }
        
        let bashCommand = {
            "name" : runCommand.command.parameters[1],
            "terminalId" : terminal ? terminal.terminalId : 1,
            "interrupt" : terminal ?  terminal.isRunning : false,
            "args": (runCommand.command.parameters.length > 2 && runCommand.command.parameters[2].args) ? runCommand.command.parameters[2].args.join(" ") : undefined
        }

        this.pushStep(runCommand, "Executing the command "+ runCommand.command.parameters[1] , "step"+ runCommand.stepIndex + ".md");
        this.renderTemplate("executeCommand.md", this.outputPathTutorial + "step" + (runCommand.stepIndex) + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, cdCommand: cdCommand, bashCommand: bashCommand });
        return null;
    }
  
    runChangeWorkspace(runCommand: RunCommand): RunResult {
        let workspacesDir = path.join('/root', runCommand.command.parameters[0]); 
        this.setVariable(this.WORKSPACE_DIRECTORY, workspacesDir);
        this.pushStep(runCommand);
        return null;
    }
    
    runAddSetupScript(runCommand: RunCommand): RunResult {
        let scriptName = path.basename(runCommand.command.parameters[0]); 
        let content = fs.readFileSync(path.join(this.playbookPath, runCommand.command.parameters[0]), 'utf8');
        fs.writeFileSync(path.join(this.setupDir, scriptName), content, {flag: "a"});
        
        this.setupScripts.push({
            "name": "Run " + scriptName,
            "script": scriptName
        });

        this.pushStep(runCommand);
        return null;

    }

    runOpenFile(runCommand: RunCommand): RunResult {
        let fileName = path.basename(runCommand.command.parameters[0]);
        let filePath = path.relative('/root', path.join(this.getVariable(this.WORKSPACE_DIRECTORY), runCommand.command.parameters[0])).replace(/\\/g, "/");
        
        this.pushStep(runCommand, "Open " + fileName, "step" + runCommand.stepIndex + ".md");

        this.renderTemplate("openFile.md", this.outputPathTutorial + "step" + runCommand.stepIndex + ".md", { text: runCommand.text, textAfter: runCommand.textAfter, fileName: fileName, filePath: filePath});
        return null; 
    }

    private renderTemplate(name: string, targetPath: string, variables) {
        if("text" in variables) {
            variables["text"] = this.converter.convertAsciidocToMarkdown(variables["text"]);
        }
        if("textAfter" in variables) {
            variables["textAfter"] = this.converter.convertAsciidocToMarkdown(variables["textAfter"]);
        }
        
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

    private pushStep(runCommand: RunCommand, title?: string, text?: string, backgroundscript?:string, foregroundscript?: string) {
        if (this.currentStepIndex != runCommand.stepIndex) {
            if(title && text){
                let stepTitle = runCommand.stepTitle ? runCommand.stepTitle : title;
                this.steps.push({
                    "title": stepTitle,
                    "text": text,
                    "courseData": backgroundscript,
                    "code": foregroundscript
                });
            }
            this.currentStepIndex++; 
        }
    }
    
    supports(name: string, parameters: any[]): boolean {
        if(name == "changeFile" && parameters[1].lineNumber){
            if(this.showVsCodeIde){
                return super.supports(name, parameters);
            }else{
                console.error("THE USAGE OF LINE NUMBER NEEDS A INSTALLED VSCODE VERSION");
                return false;
            }
        }
        else{
            return super.supports(name, parameters);
        }
    }

    async assert(runCommand: RunCommand, runResult: RunResult): Promise<void> {
        if(runResult != null) {
            new Assertions().noException(runResult);
        }
    }

}

