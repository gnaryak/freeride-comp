console.log('Loading function');

/**
 * Provide an event that contains the following keys:
 *
 *   - operation: one of the operations in the switch statement below
 *   - payload: a parameter to pass to the operation being performed
 */
exports.handler = function(event, context) {
    console.log('Received event:', JSON.stringify(event, null, 2));

    var operation = event.operation;

    switch (operation) {
        case 'echo':
            context.succeed(event.payload);
            break;
        case 'ping':
            context.succeed('pong');
            break;
        case 'error':
            context.fail(new Error('Error operation "' + operation + '"'));
            break;
        default:
            context.done(null, {hola: "mundo!"});
    }
};
