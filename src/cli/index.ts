/**
 * Alexandria Platform CLI - Permission Management
 * 
 * Command-line interface for managing and validating plugin permissions
 */

// Simple CLI implementation without external dependencies
import { PermissionsCommand } from './commands/permissions';
import { createLogger } from '../utils/logger';
import * as path from 'path';

const logger = createLogger({ serviceName: 'alexandria-cli' });

// Initialize permissions command (without services for standalone use)
const permissionsCmd = new PermissionsCommand();

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

async function main() {
  try {
    switch (command) {
      case 'list':
        const categoryIndex = args.indexOf('-c') > -1 ? args.indexOf('-c') : args.indexOf('--category');
        const category = categoryIndex > -1 ? args[categoryIndex + 1] : undefined;
        const verbose = args.includes('-v') || args.includes('--verbose');
        await permissionsCmd.listPermissions({ category, verbose });
        break;
        
      case 'validate':
        if (!args[1]) {
          console.error('Error: Please provide a plugin path');
          process.exit(1);
        }
        const pluginPath = path.resolve(args[1]);
        await permissionsCmd.validatePlugin(pluginPath);
        break;
        
      case 'search':
        if (!args[1]) {
          console.error('Error: Please provide a search term');
          process.exit(1);
        }
        await permissionsCmd.searchPermissions(args[1]);
        break;
        
      case 'help':
      default:
        console.log('\n📚 Alexandria Permission Management Help\n');
        console.log('Commands:');
        console.log('  list              List all available permissions');
        console.log('  list -c <cat>     List permissions in a specific category');
        console.log('  list -v           List permissions with detailed info');
        console.log('  validate <path>   Validate a plugin\'s permissions');
        console.log('  search <term>     Search for permissions by name');
        console.log('\nExamples:');
        console.log('  npm run permissions list');
        console.log('  npm run permissions list -- -c database');
        console.log('  npm run permissions validate ./my-plugin');
        console.log('  npm run permissions search "file"');
        break;
    }
  } catch (error) {
    logger.error('CLI error', { error });
    process.exit(1);
  }
}

// Run the CLI
main();