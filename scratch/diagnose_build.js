const { spawn } = require('child_process');
const fs = require('fs');

async function run() {
  const logStream = fs.createWriteStream('build_log.txt');
  const npmPath = '/usr/local/bin/npm'; // Probable path based on earlier find
  
  const build = spawn(npmPath, ['run', 'build'], {
    cwd: process.cwd(),
    env: { ...process.env, PATH: process.env.PATH + ':/usr/local/bin' }
  });

  build.stdout.pipe(logStream);
  build.stderr.pipe(logStream);

  build.on('close', (code) => {
    console.log(`Build exited with code ${code}`);
  });
}

run();
