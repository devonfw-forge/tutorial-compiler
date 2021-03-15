import { Environment, RunnerEnvironment } from "./environment";
import { Playbook } from "./playbook";
import { Runner } from "./runner";
import { RunCommand } from "./run_command";
import { RunResult } from "./run_result";
import { WikiRunner } from "../runners/wiki/wikiRunner";

export class Engine {

    private runners: Map<string, Runner> = new Map<string, Runner>();
    private variables: Map<string, any> = new Map<string, any>();

    constructor(private environmentName: string, private environment: Environment, private playbook: Playbook) { }

    async run() {
        console.log("Environment: " + this.environmentName);
        if (! await this.isEnvironmentComplete()) {
            if (this.environment.failOnIncomplete) {
                throw "Environment incomplete: " + this.environmentName;
            }
            console.log("Environment incomplete: " + this.environmentName);
            return;
        }
        for (let runnerIndex in this.environment.runners) {
            (await this.getRunner(this.environment.runners[runnerIndex])).init(this.playbook);
        }

        mainloop: for (let stepIndex = 0; stepIndex < this.playbook.steps.length; stepIndex++) {
            for (let lineIndex = 0; lineIndex < this.playbook.steps[stepIndex].lines.length; lineIndex++) {
                let runCommand = this.initRunCommand(stepIndex, lineIndex);
                let foundRunnerToExecuteCommand = false;
                for (let runnerIndex in this.environment.runners) {
                    let runner = await this.getRunner(this.environment.runners[runnerIndex]);
                    if (runner.supports(this.playbook.steps[stepIndex].lines[lineIndex].name)) {
                        var result = new RunResult();
                        if(runner.commandIsSkippable(runCommand.command.name)) {
                            console.log("Command " + runCommand.command.name + " will be skipped.");
                            continue;
                        }
                        try {
                            result = runner.run(runCommand);
                        }
                        catch (e) {
                            result.exceptions.push(e);
                        }
                        
                        await runner.assert(runCommand, result);
                        
                        foundRunnerToExecuteCommand = true;
                        break;
                    }
                }
                if(!foundRunnerToExecuteCommand) {
                    break mainloop;
                }   
            }
        }

        for (let runnerIndex in this.environment.runners) {
            (await this.getRunner(this.environment.runners[runnerIndex])).destroy(this.playbook);
        }
    }

    public setVariable(name: string, value: any) {
        this.variables.set(name, value);
    }

    private async isEnvironmentComplete(): Promise<boolean> {
        for (let stepIndex in this.playbook.steps) {
            for (let lineIndex in this.playbook.steps[stepIndex].lines) {
                let isSupported = false;
                for (let runnerIndex in this.environment.runners) {
                    if ((await this.getRunner(this.environment.runners[runnerIndex])).supports(this.playbook.steps[stepIndex].lines[lineIndex].name)) {
                        isSupported = true;
                        break;
                    }
                }
                if (!isSupported) {
                    return false;
                }
            }
        }

        return true;
    }

    private async getRunner(runner: RunnerEnvironment): Promise<Runner> {
        if (!this.runners.has(runner.name)) {
            await this.loadRunner(runner.name, runner.path);
        }
        return this.runners.get(runner.name);
    }

    private async loadRunner(name: string, path: string) {
        let imp = await import("../runners/" + path + "/index");
        let map = new Map<string, any>();
        for (let index in imp) {
            map.set(index.toLowerCase(), imp[index]);
        }
        let runner: Runner = new (map.get(name.toLowerCase()));
        runner.registerGetVariableCallback((name) => this.variables.get(name));
        runner.registerSetVariableCallback((name, value) => this.setVariable(name, value));
        runner.path = __dirname + "/../runners/" + path + "/";
        runner.name = name;
        runner.playbookName = this.playbook.name;
        runner.playbookPath = this.playbook.path;
        runner.playbookTitle = this.playbook.title;
        if(runner instanceof WikiRunner) {
            runner.environment = this.environmentName;
        }
        this.runners.set(name, runner);
    }

    private initRunCommand(stepIndex: number, lineIndex: number): RunCommand {
        let runCommand = new RunCommand();
        if(lineIndex == 0) {
            runCommand.text = this.playbook.steps[stepIndex].text;
        } 
        if(lineIndex == (this.playbook.steps[stepIndex].lines.length - 1)){
            runCommand.textAfter = this.playbook.steps[stepIndex].textAfter;
        }
        runCommand.command = this.playbook.steps[stepIndex].lines[lineIndex];
        runCommand.stepIndex = stepIndex;
        runCommand.lineIndex = lineIndex;
        runCommand.stepTitle = this.playbook.steps[stepIndex].title;

        return runCommand;
    }
}