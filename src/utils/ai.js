const apiai = require("apiai");

const {apiai_key} = require("../../serverSettings.json");

const app = apiai(apiai_key);

function get(Client, msg) {
    if (!msg.input_ai) return;
    let request = app.textRequest(convert(msg.input_ai), {
        sessionId: msg.author.id,
        timezone: "Europe/Rome"
    });

    request.on("response", function(response) {
        if (response.result.actionIncomplete) {
            let text = convertBack(response.result.fulfillment.messages[0].speech);
            text = personalize(Client, msg, text);
            Client.send(msg, text);
        } else {
            msg.params = [];
            for (let key in response.result.parameters) {
                if (response.result.parameters[key] !== "") {
                    msg.params.push(response.result.parameters[key]);
                }
            }

            if (response.result.action) {
                msg.command = response.result.action;
            }

            if (response.result.action.includes("reminders")) {
                response.result.parameters.contexts = response.result.contexts;
                Client.events.process(msg, response.result.action, response.result.parameters);
            } else if (response.result.action === "input.unknown") {
                Client.send(msg, "I didn't understand that :shrug:");
            } else if (response.result.fulfillment.messages[0].speech) {
                let text = convertBack(response.result.fulfillment.messages[0].speech);
                text = personalize(Client, msg, text);
                Client.send(msg, text).then(() => {
                    Client.execute.call(Client, msg);
                });
            } else {
                Client.execute.call(Client, msg);
            }
        }
    });

    request.on("error", function (error) {
        Client.send(msg, error;
    });

    request.end();
}

function convert(phrase) {
    return phrase
        .replace(/<@&/g, "ROLEID")
        .replace(/<@/g, "USERID")
        .replace(/>/g, "SOMEIDEND");
}

function convertBack(phrase) {
    return phrase
        .replace(/ROLEID/g, "<@&")
        .replace(/USERID/g, "<@")
        .replace(/SOMEIDEND/g, ">");
}

function personalize(Client, msg, response) {
    return response
        .replace(/BOTNAME/g, msg.client.user.username);
}

module.exports = {
    get: get
};
