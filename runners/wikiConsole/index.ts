import { Playbook } from "../../engine/playbook";
import { RunCommand } from "../../engine/run_command";
import { RunResult } from "../../engine/run_result";
import { WikiRunner } from "../../engine/wikiRunner";
import * as path from "path";
import * as fs from "fs";


export class WikiConsole extends WikiRunner {

    

    init(playbook: Playbook): void {
        super.init(playbook);
        this.setVariable(this.WORKSPACE_DIRECTORY, path.join(this.getWorkingDirectory()));
        this.renderWiki(path.join(this.getRunnerDirectory(), "templates", "intro.asciidoc"), {name: playbook.name, title: playbook.title, subtitle: playbook.subtitle, description: playbook.description});
    }

    async destroy(playbook: Playbook): Promise<void> {
        if(playbook.conclusion) {
            this.renderWiki(path.join(this.getRunnerDirectory(), "templates", "conclusion.asciidoc"), { conclusion: playbook.conclusion});
        }
        super.destroy(playbook);
    }

    runInstallDevonfwIde(runCommand: RunCommand): RunResult {
        let tools = runCommand.command.parameters[0].join(" ");
        let version = "";
        if(runCommand.command.parameters.length == 2) {
            version = runCommand.command.parameters[1];
        }
        this.renderWiki(path.join(this.getRunnerDirectory(), "templates", "installDevonfwIde.asciidoc"), { tools: tools, version:version })
        this.setVariable(this.WORKSPACE_DIRECTORY, path.join(this.getWorkingDirectory(), "devonfw", "workspaces", "main"));
        this.setVariable(this.INSTALLED_TOOLS, tools);
        return null;
    }

    runRestoreDevonfwIde(runCommand: RunCommand): RunResult {
        return this.runInstallDevonfwIde(runCommand);
    }


    runChangeFile(runCommand: RunCommand): RunResult{
            let workspacePath = this.getVariable(this.WORKSPACE_DIRECTORY).replace(/\\/g, "/");
            let filePath = path.join(workspacePath,runCommand.command.parameters[0]);
            let fileName = path.basename(runCommand.command.parameters[0]);
            let contentPath, contentString;
            if(runCommand.command.parameters[1].fileConsole || runCommand.command.parameters[1].contentConsole){
                contentPath = runCommand.command.parameters[1].fileConsole;
                contentString = runCommand.command.parameters[1].contentConsole;
            }else{
                contentPath = runCommand.command.parameters[1].file;
                contentString = runCommand.command.parameters[1].content;
            }
            contentPath = contentPath 
                ? path.join(this.getPlaybookPath(), contentPath)
                : undefined;
            let contentFile = contentPath 
                ? path.basename(contentPath)
                : undefined;
            let placeholder = runCommand.command.parameters[1].placeholder;
            let lineNumber = runCommand.command.parameters[1].lineNumber;
    
            this.renderWiki(path.join(this.getRunnerDirectory(), "templates", "changeFile.asciidoc"), {filePath : filePath,
                 contentPath: contentPath, contentString: contentString, placeholder: placeholder, lineNumber: lineNumber, fileName: fileName, contentFile: contentFile});
            return null;
    }

    runRunServerJava(runCommand: RunCommand): RunResult {
        let server_path = path.join(this.getVariable(this.WORKSPACE_DIRECTORY), runCommand.command.parameters[0]);
        this.renderWiki(path.join(this.getRunnerDirectory(), "templates", "runServerJava.asciidoc"), { server_path: server_path, port: runCommand.command.parameters[1].port, app_path: runCommand.command.parameters[1].path })
        return null;
    }

    runNpmInstall(runCommand: RunCommand): RunResult {
        let projectPath = path.join(this.getVariable(this.WORKSPACE_DIRECTORY), runCommand.command.parameters[0]);
        let npmCommand = {
            "name": (runCommand.command.parameters.length > 1 && runCommand.command.parameters[1].name) ? runCommand.command.parameters[1].name : undefined,
            "global": (runCommand.command.parameters.length > 1 && runCommand.command.parameters[1].global) ? runCommand.command.parameters[1].global : false, 
            "args": (runCommand.command.parameters.length > 1 && runCommand.command.parameters[1].args) ? runCommand.command.parameters[1].args.join(" ") : undefined
        };

        this.renderWiki(path.join(this.getRunnerDirectory(), "templates", "npmInstall.asciidoc"), { projectPath: projectPath, npmCommand: npmCommand });
        return null;
    }
  
    runCloneRepository(runCommand: RunCommand): RunResult {
        let directoryPath = path.join(this.getVariable(this.WORKSPACE_DIRECTORY), runCommand.command.parameters[0]);
        this.renderWiki(path.join(this.getRunnerDirectory(), "templates", "cloneRepository.asciidoc"), { directoryPath: directoryPath, url: runCommand.command.parameters[1] });
        return null;
    }


    runDownloadFile(runCommand: RunCommand): RunResult{
        let url = runCommand.command.parameters[0];
        let fileName = runCommand.command.parameters[1];
        let dir = runCommand.command.parameters[2];
        this.renderWiki(path.join(this.getRunnerDirectory(), "templates", "downloadFile.asciidoc"), {url: url, dir: dir, fileName: fileName});
        
        return null;
    }
      
    runBuildNg(runCommand: RunCommand): RunResult {
        let angularPath = path.join(this.getVariable(this.WORKSPACE_DIRECTORY), runCommand.command.parameters[0]);
        let outputPath = runCommand.command.parameters.length < 1 ? runCommand.command.parameters[1] : "";
        this.renderWiki(path.join(this.getRunnerDirectory(), "template", "buildNg.asciidoc"), {angularPath: angularPath, outputPath: outputPath});
      
        return null;
    }


    runDockerCompose(runCommand: RunCommand): RunResult {
        let dir = runCommand.command.parameters[0];
        this.renderWiki(path.join(this.getRunnerDirectory(), "templates", "dockerCompose.asciidoc"), { dir: dir, port: runCommand.command.parameters[1].port, app_path: runCommand.command.parameters[1].path })
        return null;
    }
  
    runCreateFolder(runCommand: RunCommand): RunResult {
        let folderPath = path.join(this.getVariable(this.WORKSPACE_DIRECTORY), runCommand.command.parameters[0]);
        this.renderWiki(path.join(this.getRunnerDirectory(), "templates", "createFolder.asciidoc"), { folderPath: folderPath });
        return null;
    }

    runBuildJava(runCommand: RunCommand): RunResult {
        let directoryPath = path.join(this.getVariable(this.WORKSPACE_DIRECTORY), runCommand.command.parameters[0]);
        let skipTest = (runCommand.command.parameters.length == 2 && runCommand.command.parameters[1] == true) ? false : true;
        this.renderWiki(path.join(this.getRunnerDirectory(), "templates", "buildJava.asciidoc"), { directoryPath: directoryPath, skipTest: skipTest });
        return null;
    }

    runInstallCobiGen(runCommand: RunCommand): RunResult{
        let devonPath = path.relative(this.getWorkingDirectory(), this.getVariable(this.WORKSPACE_DIRECTORY)).replace(/\\/g, "/");;
        this.renderWiki(path.join(this.getRunnerDirectory(), "templates", "installCobiGen.asciidoc"), {devonPath: devonPath});
        return null;
    }

    runCreateDevon4jProject(runCommand: RunCommand): RunResult {
        this.renderWiki(path.join(this.getRunnerDirectory(), "templates", "createDevon4jProject.asciidoc"), { name: runCommand.command.parameters[0] });
        return null;
    }
    
    runCreateDevon4ngProject(runCommand: RunCommand): RunResult {
        let cdCommand = runCommand.command.parameters[1];
        let ngParams = runCommand.command.parameters.length > 2 && (runCommand.command.parameters[2] instanceof Array) ? runCommand.command.parameters[2].join(" ") : "";
        this.renderWiki(path.join(this.getRunnerDirectory(), "templates", "createDevon4ngProject.asciidoc"), {cdCommand: cdCommand, projectName: runCommand.command.parameters[0], ngParams: ngParams})

    runAddSetupScript(runCommand: RunCommand): RunResult{
        let scriptNameLinux = path.basename(runCommand.command.parameters[0]);
        let scriptNameWindows = path.basename(runCommand.command.parameters[1]);
        let windowsContent = fs.readFileSync(path.join(this.playbookPath, runCommand.command.parameters[1]), { encoding: "utf-8" });
        let linuxContent = fs.readFileSync(path.join(this.playbookPath, runCommand.command.parameters[0]), { encoding: "utf-8" });
        this.renderWiki(path.join(this.getRunnerDirectory(), "templates", "addSetupScript.asciidoc"), {scriptNameWindows: scriptNameWindows, windowsContent: windowsContent,
             scriptNameLinux: scriptNameLinux, linuxContent: linuxContent});
      return null;
    }

    runAdaptTemplatesCobiGen(runComannd: RunCommand): RunResult{
        let devonPath = path.relative(this.getWorkingDirectory(), this.getVariable(this.WORKSPACE_DIRECTORY)).replace(/\\/g, "/");
        this.renderWiki(path.join(this.getRunnerDirectory(), "templates", "adaptTemplates.asciidoc"), {devonPath: devonPath});
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
                fs.appendFileSync(tempFile, "![" + path.basename(image) + "](./assets/" + path.basename(image) + ")");
            }
            fs.appendFileSync(tempFile, "\n\n");
        }

        let content = fs.readFileSync(tempFile, "utf-8");
        this.renderWiki(path.join(this.getRunnerDirectory(), "templates", "nextKatacodaStep.asciidoc"), { title: runCommand.command.parameters[0], content: content, path: runCommand.command.parameters[2]});
      
        return null;
    }
}

