// code-execution.js - Place this file in your project root directory
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Create execution directory if it doesn't exist
const executionDir = path.join(__dirname, 'code-executions');
if (!fs.existsSync(executionDir)) {
  fs.mkdirSync(executionDir);
}

// Maximum execution time in milliseconds
const MAX_EXECUTION_TIME = 5000;

// Clean up temporary files
function cleanupFiles(filePaths) {
  filePaths.forEach(filePath => {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error(`Failed to delete temp file ${filePath}:`, err);
    }
  });
}

// Execute code with timeouts and safety measures
async function executeCode(code, language) {
  // Generate a unique ID for this execution
  const executionId = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const startTime = process.hrtime();
  
  let filePath, commandToRun, filesToCleanup = [];
  
  try {
    // Prepare files and commands based on language
    switch (language) {
      case 'javascript':
        filePath = path.join(executionDir, `${executionId}.js`);
        fs.writeFileSync(filePath, code);
        commandToRun = `node ${filePath}`;
        filesToCleanup.push(filePath);
        break;
        
      case 'python':
        filePath = path.join(executionDir, `${executionId}.py`);
        fs.writeFileSync(filePath, code);
        commandToRun = `python ${filePath}`;
        filesToCleanup.push(filePath);
        break;
        
      case 'java':
        // Extract class name from code
        const classNameMatch = code.match(/public\s+class\s+(\w+)/);
        if (!classNameMatch) {
          return {
            success: false,
            error: 'Could not find a public class in your Java code',
            executionTime: 0
          };
        }
        
        const className = classNameMatch[1];
        filePath = path.join(executionDir, `${className}.java`);
        fs.writeFileSync(filePath, code);
        
        // First compile, then run
        const compileCommand = `javac -d ${executionDir} ${filePath}`;
        
        // Execute the compile command
        const compileResult = await new Promise((resolve) => {
          exec(compileCommand, { timeout: MAX_EXECUTION_TIME }, (error, stdout, stderr) => {
            if (error) {
              resolve({ 
                success: false, 
                error: stderr || error.message,
                executionTime: 0
              });
            } else {
              resolve({ success: true });
            }
          });
        });
        
        if (!compileResult.success) {
          cleanupFiles([filePath]);
          return compileResult;
        }
        
        commandToRun = `java -cp ${executionDir} ${className}`;
        filesToCleanup.push(filePath, path.join(executionDir, `${className}.class`));
        break;
        
      case 'cpp':
        filePath = path.join(executionDir, `${executionId}.cpp`);
        const outputPath = path.join(executionDir, executionId);
        fs.writeFileSync(filePath, code);
        
        // First compile, then run
        const cppCompileCommand = `g++ ${filePath} -o ${outputPath}`;
        
        // Execute the compile command
        const cppCompileResult = await new Promise((resolve) => {
          exec(cppCompileCommand, { timeout: MAX_EXECUTION_TIME }, (error, stdout, stderr) => {
            if (error) {
              resolve({ 
                success: false, 
                error: stderr || error.message,
                executionTime: 0
              });
            } else {
              resolve({ success: true });
            }
          });
        });
        
        if (!cppCompileResult.success) {
          cleanupFiles([filePath]);
          return cppCompileResult;
        }
        
        commandToRun = outputPath;
        filesToCleanup.push(filePath, outputPath);
        break;
        
      default:
        return {
          success: false,
          error: `Unsupported language: ${language}`,
          executionTime: 0
        };
    }
    
    // Execute the code with timeout
    const result = await new Promise((resolve) => {
      exec(commandToRun, { timeout: MAX_EXECUTION_TIME }, (error, stdout, stderr) => {
        const endTime = process.hrtime(startTime);
        const executionTime = Math.round((endTime[0] * 1000) + (endTime[1] / 1000000));
        
        if (error) {
          // Check if it's a timeout error
          if (error.killed && error.signal === 'SIGTERM') {
            resolve({
              success: false,
              error: 'Execution timed out',
              executionTime
            });
          } else {
            resolve({
              success: false,
              error: stderr || error.message,
              executionTime
            });
          }
        } else {
          resolve({
            success: true,
            output: stdout,
            executionTime
          });
        }
      });
    });
    
    // Clean up temporary files
    cleanupFiles(filesToCleanup);
    
    return result;
    
  } catch (error) {
    // Make sure to clean up files in case of error
    if (filesToCleanup.length > 0) {
      cleanupFiles(filesToCleanup);
    }
    
    return {
      success: false,
      error: error.message,
      executionTime: 0
    };
  }
}

// Test cases with timeout
async function runTestCases(code, language, testCases) {
  const results = [];
  
  for (const test of testCases) {
    try {
      // Modify code to use the test case input
      let modifiedCode;
      
      switch (language) {
        case 'javascript':
          modifiedCode = `${code}\n\nconsole.log(solution(${JSON.stringify(test.input)}));`;
          break;
        case 'python':
          modifiedCode = `${code}\n\nprint(solution(${JSON.stringify(test.input)}))`;
          break;
        case 'java':
          // This requires more sophisticated code modification for Java
          modifiedCode = code.replace(
            /public static void main\([^)]*\)\s*{[^}]*}/s,
            `public static void main(String[] args) { System.out.println(solution(${JSON.stringify(test.input)})); }`
          );
          break;
        case 'cpp':
          // This requires more sophisticated code modification for C++
          modifiedCode = code.replace(
            /int main\([^)]*\)\s*{[^}]*}/s,
            `int main() { cout << solution(${JSON.stringify(test.input)}) << endl; return 0; }`
          );
          break;
        default:
          results.push({
            success: false,
            error: `Unsupported language for test cases: ${language}`,
            test
          });
          continue;
      }
      
      // Execute the modified code
      const result = await executeCode(modifiedCode, language);
      
      // Compare output with expected
      if (result.success) {
        // Normalize output (trim whitespace, etc.)
        const normalizedOutput = result.output.trim();
        const normalizedExpected = String(test.output).trim();
        
        result.testPassed = normalizedOutput === normalizedExpected;
        result.expected = test.output;
      }
      
      results.push({
        ...result,
        test
      });
      
    } catch (error) {
      results.push({
        success: false,
        error: error.message,
        test
      });
    }
  }
  
  return results;
}

module.exports = {
  executeCode,
  runTestCases
};