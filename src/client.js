const fs = require("fs");
const Discord = require("discord.js");
const Logger = require("./utils/logger");

/***************/
/****Exports****/
/***************/

function run() {
    Client.bot = new Discord.Client();
    Client.shard = new Discord.ShardClientUtil(Client.bot);
    Client.prefix = Client.serverSettings.prefix;
    Client.mysql_db = Client.serverSettings.mysql_db;
    Client.bot.login(Client.serverSettings.token);
    Client.bot.on("ready", setup);

    Client.bot.on("message", recieveMessage);

    Client.bot.on("guildCreate", (guild) => {
        Client.discordbots.set(Client);
        if (Client.blackList.guilds.includes(guild.id)) {
            guild.leave().then(() => {
                Logger.info(`Shard[${Client.shard.id}]:[+]Left guild on blacklist: ${guild.id}`);
            });
        } else {
            Client.db.addGuild(guild.id);
        }
    });

    Client.bot.on("guildDelete", (guild) => {
        Logger.info(`Shard[${Client.shard.id}]:[+]Left guild: ${guild.id}`);
    });

    Client.bot.on("guildMemberRemove", (member) => {
        Client.db.setServerStats(member.guild.id, "guildMemberRemove", member.id);
    });

    Client.bot.on("guildBanAdd", (guild, user) => {
        Client.db.setServerStats(guild.id, "guildBanAdd", user.id);
    });

    Client.bot.on("guildBanRemove", (guild, user) => {
        Client.db.setServerStats(guild.id, "guildBanRemove", user.id);
    });

    Client.bot.on("guildMemberAdd", (member) => {
        Client.welcome(Client, member);
        Client.db.setServerStats(member.guild.id, "guildMemberAdd", member.id);
        Client.db.getStats_users(member.guild.id, "all").then((memberx) => {
            if (memberx.length) {
                Client.db.setStats_users(member.guild.id, member.id, "MSG_SENT", 0);
            }
        });
    });
}

function recieveMessage(msg) {
    isCommand(msg).then((msg) => {
        if (!msg.interact && !msg.isCommand) return msg;
        if (Client.antispam.check(Client, msg)) return msg;

        if (msg.isCommand) {
            command(msg);
        } else if (msg.interact) {
            interact(msg);
        }
        return msg;
    }).then((msg) => {
        Client.db.setStats_bot("messages", 1);
        if (msg.channel.type === "text" && !msg.webhookID) {
            Client.db.getStats_users(msg.guild.id, msg.author.id).then((member) => {
                if (member) Client.db.setStats_users(msg.guild.id, msg.author.id, "MSG_SENT", 1);
            });
        }
    });
}

function command(msg) {
    if (msg.channel.type === "text") {
        Client.db.getSettings(msg.guild.id, "deleteCommands").then((value) => {
            if (+value) msg.delete();
        });
    }
    execute(msg);
    Logger.log(`Shard[${Client.shard.id}]: ${msg.guild.id} ${msg.author.tag} ${msg.command} ${msg.params}`);

}

function interact(msg) {
    if (msg.channel.type === "text") {
        Client.db.getSettings(msg.guild.id, "ai").then((value) => {
            if (+value || msg.interactName) {
                Client.ai.get(Client, msg);
                Logger.log(`Shard[${Client.shard.id}]: ${msg.channel.type} ${msg.author.id} ${msg.input_ai}`);
            }
        });
    } else {
        Client.ai.get(Client, msg);
        Logger.log(`Shard[${Client.shard.id}]: ${msg.channel.type} ${msg.author.id} ${msg.input_ai}`);
    }
}

function setup() {
    Client.bot.shard.send({type: "connected"});
    Client.db.setup(Client);
    Client.events.start(Client);
   

    for (let key of Client.bot.guilds) {
        if (Client.blackList.guilds.includes(key[0])) {
            key[1].leave().then( () => {
                Logger.info(`Shard[${Client.shard.id}]:[+]Left guild on blacklist: ${key}`);
            });
        }
    }

    Client.bot.fetchUser(Client.serverSettings.botOwner).then((user) => {
        Client.botOwner = user;
    });

    addDirToCommands(`${__dirname}/commands`);
    Logger.success(`Shard[${Client.shard.id}]:[+]setup ready ${Client.bot.guilds.size} guilds connected.`);
}

/**************/
/*****DATA*****/
/**************/

function log(msg, userID, sort, reason, time) {

    let data = {
        user: userID,
        type: sort,
        mod: msg.author.id,
        timestamp: Date.now(),
        reason: reason,
        time: time
    };

    Client.db.setModlog(msg.guild.id, data);

    let embed = new Client.RichEmbed();

    switch (sort) {
        case "warn":
            embed.setTitle("Warning");
            embed.setColor(Client.statusColors.get(sort));
            embed.setDescription(`**Mod**: <@${data.mod}>\n**Member:** <@${data.user}>\n**Reason:** ${data.reason}`);
            break;
        case "kick":
            embed.setTitle("Kick");
            embed.setColor(Client.statusColors.get(sort));
            embed.setDescription(`**Mod**: <@${data.mod}>\n**Kicked**: <@${data.user}>\n**Reason**: ${data.reason}`);
            break;
        case "ban":
            embed.setTitle("Ban");
            embed.setColor(Client.statusColors.get(sort));
            embed.setDescription(`**Mod**: <@${data.mod}>\n**Banned**: <@${data.user}>\n**Reason**: ${data.reason}`);
            break;
        case "tempban":
            embed.setTitle("Temp Ban");
            embed.setColor(Client.statusColors.get(sort));
            embed.setDescription(`"**Mod**: <@${data.mod}>\n**Tempbanned**: <@${data.user}>\n**Days**: ${data.time} days\n**Reason**: ${data.reason}`);
            break;
        case "unban":
            embed.setTitle("Unban");
            embed.setColor(Client.statusColors.get(sort));
            embed.setDescription(`**Mod**: <@${data.mod}>\n**Unbanned**: <@${data.user}>`);
            break;
        case "note":
            embed.setTitle("Note");
            embed.setColor(Client.statusColors.get(sort));
            embed.setDescription(`**Mod**: <@${data.mod}>\n**Note about**: <@${data.user}>\n**Content**: ${data.reason}`);
            break;
    }

    Client.db.getSettings(msg.guild.id, "logchannel").then((channelId) => {
        if (channelId) {
            sendChannel(msg, channelId, embed);
        }
    });
}

function createEmbed(colorName, description, title, fields, footer) {
    let color;
    if (Client.statusColors.has(colorName)) {
        color = Client.statusColors.get(colorName);
    } else {
        color = Client.statusColors.get("default");
    }

    return {
        embed: {
            color,
            description,
            title,
            fields,
            footer
        }
    };
}

/***************/
/***FUNCTIONS***/
/***************/

function execute(msg) {
    let command = Client.commands.get(msg.command);
    if (!command) return;

    if (command.guildOnly && msg.channel.type !== "text") {
        return msg.reply("No no no! Don't use this in DM's :scream:");
    }

    if (command.args > msg.params.length) {
        let reply = `You are using this command wrong :expressionless:, ${msg.author}!`;

        if (command.usage) {
            reply += `\nTry this: \`${Client.prefix}${command.name} ${command.usage}\``;
        } else {
            reply += `\nTry this: \`${Client.prefix}${command.name}\``;
        }

        return msg.channel.send(createEmbed("fail", reply));
    }

    let guild = "0";
    if (msg.channel.type === "text") guild = msg.guild.id;

    Client.db.getPermissions(guild, msg.command).then((value) => {
        if (value === undefined || value === 0) return;

        try {
            if (msg.permissionLevel >= value) {
                command.execute(Client, msg);
            } else {
                if (command.failPermission) {
                    send(msg, createEmbed("info", command.failPermission));
                }
            }
        } catch (e) {
            let message = createEmbed("info", ":bomb: :boom: That didn't work out :neutral_face:");
            send(msg, message);
            Logger.error(`Shard[${Client.shard.id}]:${e}`);
        }
    });
}

function isCommand(msg) {
    return new Promise((resolve, reject) => {
        if (msg.author.bot || msg.webhookID) return resolve(msg);

        getPrefix(msg).then((prefix) => {
            msg.prefix = prefix;
            if (msg.content.slice(0, prefix.length).toLowerCase() === prefix.toLowerCase()) {
                msg.params = msg.content.slice(prefix.length).split(" ");
                msg.command = msg.params.shift().toLowerCase();
                msg.isCommand = true;

                if (msg.channel.type === "text" && msg.member == null) {
                    msg.guild.fetchMember(msg.author.id).then((member) => {
                        msg.member = member;
                        resolve(msg);
                    }).catch(reject);
                } else {
                    resolve(msg);
                }
            } else if (msg.content.toLowerCase().includes(msg.client.user.username.toLowerCase())) {
                if (msg.content.toLowerCase().includes("https://dupbit.com/dupbot")) return resolve(msg);
                msg.interact = true;

                let words = msg.content.split(" ");

                let index = words.map(y => y.toLowerCase()).indexOf(msg.client.user.username.toLowerCase());
                if (index === -1) {
                    index = words.map(y => y.toLowerCase()).indexOf(msg.client.user.username.toLowerCase() + ",");
                    if (index === 0) msg.interactName = true;
                }
                if (index === 0 || index === words.length - 1) {
                    words.splice(index, 1);
                }

                msg.input_ai = words.join(" ");

                resolve(msg);

            } else if (msg.channel.type === "dm") {
                msg.interact = true;
                msg.input_ai = msg.content;
                resolve(msg);
            } else {
                resolve(msg);
            }
        });
    }).then((msg) => {
        return new Promise((resolve, reject) => {
            if (!msg.interact && !msg.isCommand) resolve(msg);

            let guild = "0";
            if (msg.channel.type === "text") guild = msg.guild.id;
            Client.db.getSettings(guild, "adminrole").then((role) => {
                Client.db.getSettings(guild, "support").then((support) => {
                    if (msg.channel.type === "text" && msg.member == null) {
                        msg.guild.fetchMember(msg.author.id).then((member) => {
                            msg.member = member;
                            msg.permissionLevel = getPermissionLevel(msg, role, support);
                            resolve(msg);
                        }).catch(reject);
                    }
                    msg.permissionLevel = getPermissionLevel(msg, role, support);
                    resolve(msg);
                }).catch(reject);
            }).catch(reject);
        }).catch(error => Logger.error(`Shard[${Client.shard.id}]:${error}`));
    }).catch(error => Logger.error(`Shard[${Client.shard.id}]:${error}`));
}

async function getPrefix(msg) {
    let prefix = Client.prefix;
    if (msg.channel.type === "text") {
        let pref = await Client.db.getSettings(msg.guild.id, "prefix");
        if (pref) prefix = pref;
    }
    return prefix;
}

function addDirToCommands(path) {
    let files = fs.readdirSync(path);
    for (let file of files) {
        if (fs.lstatSync(`${path}/${file}`).isDirectory()) {
            addDirToCommands(`${path}/${file}`);
        } else {
            let command = require(`${path}/${file}`);
            Client.commands.set(command.name, command);
        }
    }
}

function getPermissionLevel(msg, adminRole="", support=true) {
    if (msg.author.id === Client.serverSettings.botOwner && support == true) {
        return 4;
    } else if (msg.channel.type === "dm" || (msg.channel.type === "text" && (msg.member.hasPermission("ADMINISTRATOR") || msg.member.id === msg.guild.ownerID))) {
        return 3;
    } else if (msg.member.roles.has(adminRole)) {
        return 2;
    } else {
        return 1;
    }
}

async function extractMember(msg, pos) {
    if (msg.mentions.members.size) return msg.mentions.members.first();

    let userId = msg.params[pos];
    if (msg.guild.members.has(userId)) return msg.guild.members.get(userId);

    return msg.guild.fetchMember(userId).then((member) => {
        return member;
    }).catch(() => {
        return null;
    });
}

function extractRole(msg, pos) {
    if (msg.mentions.roles.size) return msg.mentions.roles.first();
    if (msg.content.match(/<@&\d+>/)) {
        let roleId = msg.content.match(/<@&\d+>/)[1];
        if (msg.guild.roles.has(roleId)) return msg.guild.roles.get(roleId);
    }
    let role = msg.guild.roles.find(role => role.name.toLowerCase() === msg.params[pos].toLowerCase());
    if (role) return role;
    if (msg.guild.roles.has(msg.params[pos])) return msg.guild.roles.get(msg.params[pos]);
    return null;
}

function extractChannel(msg, pos) {
    if (msg.mentions.channels.size) return msg.mentions.channels.first();
    let channel = msg.guild.channels.find(channel => channel.name.toLowerCase() === msg.params[pos] || channel.id === msg.params[pos]);
    if (channel) return channel;
    return null;
}

function send(msg, message) {
    return new Promise((resolve, reject) => {
        if (msg.channel.type === "text" && !msg.channel.permissionsFor(msg.client.user).has("SEND_MESSAGES")) return reject("No SEND_MESSAGES permission");
        msg.channel.send(message).then(resolve, reject);
    }).catch(error => Logger.error(`Shard[${Client.shard.id}]:${error}`));
}

function sendChannel(msg, channelId, message) {
    return new Promise((resolve, reject) => {
        if (!msg.guild.channels.get(channelId).permissionsFor(msg.client.user).has("SEND_MESSAGES")) return reject("No SEND_MESSAGES permission");
        msg.guild.channels.get(channelId).send(message).then(resolve, reject);
    }).catch(error => Logger.error(`Shard[${Client.shard.id}]:${error}`));
}

function joinVoiceChannel(msg) {
    return new Promise((resolve, reject) => {
        Client.db.getSettings(msg.guild.id, "voiceChannel").then((value) => {
            if (value) {
                msg.guild.channels
                    .get(value)
                    .join()
                    .then(resolve, reject);
            } else {
                msg.member.voiceChannel
                    .join()
                    .then(resolve, reject);
            }
        });
    }).catch(error => Logger.error(`Shard[${Client.shard.id}]:${error}`));
}

const Client = {
    serverSettings: require("../serverSettings.json"),
    blackList: require("../blackList.json"),
    statusColors: require("../data/statusColors"),


    cah: require("./minigames/cahgamehandler"),
    events: require("./events/events"),

 
    ai: require("./utils/ai"),
   
    db: require("./utils/database"),
    welcome: require("./utils/welcome"),

    RichEmbed: Discord.RichEmbed,
    Attachment: Discord.Attachment,
    Collection: Discord.Collection,

    Logger,

    commands: new Discord.Collection(),

    execute,

    getPrefix,

    createEmbed,

    log,
    extractRole,
    extractMember,
    extractChannel,

    send,
    sendChannel,
    joinVoiceChannel,
};

if (require.main === module) {
    run();
}
