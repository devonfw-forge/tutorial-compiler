import { RunResult } from "../../engine/run_result";
import * as child_process from "child_process";
import * as path from 'path';

export class ConsoleUtils {
    static executeCommandSync(command: string, directory: string, result: RunResult, env: any, input?: string) {
        if(result.returnCode != 0) return;

        let process = child_process.spawnSync(command, { shell: true, cwd: directory, input: input, maxBuffer: Infinity, env: env });
        if(process.status != 0) {
            console.log("Error executing command: " + command + " (exit code: " + process.status + ")");
            console.log(process.stderr.toString(), process.stdout.toString());
            result.returnCode = process.status;
        }
    }

    static executeDevonCommandSync(devonCommand: string, directory: string, devonInstallDirectory: string, result: RunResult, env: any, input?: string) {
        let scriptsDir = path.join(devonInstallDirectory, "scripts");
        ConsoleUtils.executeCommandSync(path.join(scriptsDir, "devon") + " " + devonCommand, directory, result, env, input);
    }

    static executeCommandAsync(command: string, directory: string, result: RunResult, env: any): child_process.ChildProcess {
        if(result.returnCode != 0) return;

        let process = child_process.spawn(command, [], { shell: true, cwd: directory, env: env });
        if(!process.pid) {
            result.returnCode = 1;
        }
        return process;
    }

    static executeDevonCommandAsync(devonCommand: string, directory: string, devonInstallDirectory: string, result: RunResult, env: any): child_process.ChildProcess {
        let scriptsDir = path.join(devonInstallDirectory, "scripts");
        return ConsoleUtils.executeCommandAsync(path.join(scriptsDir, "devon") + " " + devonCommand, directory, result, env);
    }
}