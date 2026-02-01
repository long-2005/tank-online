// scale-helper.js - Manual scaling utility
// Usage: node scale-helper.js [up|down|set N|status]

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function runCommand(cmd) {
    try {
        const { stdout, stderr } = await execPromise(cmd);
        return { success: true, output: stdout, error: stderr };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getCurrentScale() {
    const result = await runCommand('docker-compose ps -q game-service');
    if (!result.success) return 0;

    const lines = result.output.trim().split('\n').filter(line => line.length > 0);
    return lines.length;
}

async function scaleToN(n) {
    if (n < 1 || n > 10) {
        console.error(' Scale must be between 1 and 10');
        return false;
    }

    console.log(` Scaling to ${n} instance(s)...`);
    const result = await runCommand(`docker-compose up -d --scale game-service=${n} --no-recreate`);

    if (result.success) {
        console.log(` Successfully scaled to ${n} instance(s)`);
        return true;
    } else {
        console.error(` Failed to scale:`, result.error);
        return false;
    }
}

async function showStatus() {
    console.log('\n Current Status:\n');

    const current = await getCurrentScale();
    console.log(`   Running Containers: ${current}`);

    const psResult = await runCommand('docker-compose ps game-service');
    if (psResult.success) {
        console.log('\n' + psResult.output);
    }
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command) {
        console.log('Usage: node scale-helper.js [up|down|set N|status]');
        console.log('  up      - Scale up by 1');
        console.log('  down    - Scale down by 1');
        console.log('  set N   - Set to N instances');
        console.log('  status  - Show current status');
        return;
    }

    const current = await getCurrentScale();

    switch (command.toLowerCase()) {
        case 'up':
            await scaleToN(current + 1);
            break;
        case 'down':
            await scaleToN(Math.max(1, current - 1));
            break;
        case 'set':
            const n = parseInt(args[1]);
            if (isNaN(n)) {
                console.error(' Please provide a number: node scale-helper.js set <N>');
            } else {
                await scaleToN(n);
            }
            break;
        case 'status':
            await showStatus();
            break;
        default:
            console.error(` Unknown command: ${command}`);
    }
}

main().catch(console.error);
