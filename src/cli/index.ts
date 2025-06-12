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
        const categoryIndex =
          args.indexOf('-c') > -1 ? args.indexOf('-c') : args.indexOf('--category');
        const category = categoryIndex > -1 ? args[categoryIndex + 1] : undefined;
        const verbose = args.includes('-v') || args.includes('--verbose');
        await permissionsCmd.listPermissions({ category, verbose });
        break;

      case 'validate':
        if (!args[1]) {
          logger.error('Error: Please provide a plugin path');
          process.exit(1);
        }
        const pluginPath = path.resolve(args[1]);
        await permissionsCmd.validatePlugin(pluginPath);
        break;

      case 'search':
        if (!args[1]) {
          logger.error('Error: Please provide a search term');
          process.exit(1);
        }
        await permissionsCmd.searchPermissions(args[1]);
        break;

      case 'help':
      default:
        logger.info('Alexandria Permission Management Help', {
          commands: {
            list: 'List all available permissions',
            'list -c <cat>': 'List permissions in a specific category',
            'list -v': 'List permissions with detailed info',
            'validate <path>': "Validate a plugin's permissions",
            'search <term>': 'Search for permissions by name'
          },
          examples: [
            'npm run permissions list',
            'npm run permissions list -- -c database',
            'npm run permissions validate ./my-plugin',
            'npm run permissions search "file"'
          ]
        });
        // Also output to console for CLI user experience
        process.stdout.write('\n📚 Alexandria Permission Management Help\n\n');
        process.stdout.write('Commands:\n');
        process.stdout.write('  list              List all available permissions\n');
        process.stdout.write('  list -c <cat>     List permissions in a specific category\n');
        process.stdout.write('  list -v           List permissions with detailed info\n');
        process.stdout.write("  validate <path>   Validate a plugin's permissions\n");
        process.stdout.write('  search <term>     Search for permissions by name\n');
        process.stdout.write('\nExamples:\n');
        process.stdout.write('  npm run permissions list\n');
        process.stdout.write('  npm run permissions list -- -c database\n');
        process.stdout.write('  npm run permissions validate ./my-plugin\n');
        process.stdout.write('  npm run permissions search "file"\n');
        break;
    }
  } catch (error) {
    logger.error('CLI error', { error });
    process.exit(1);
  }
}

// Run the CLI
main();
