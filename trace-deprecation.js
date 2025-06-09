
        process.on('warning', (warning) => {
          if (warning.name === 'DeprecationWarning') {
            console.log('DEPRECATION_TRACE:', JSON.stringify({
              message: warning.message,
              stack: warning.stack
            }));
          }
        });
        require('../src/index.js');
      