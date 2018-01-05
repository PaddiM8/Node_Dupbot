module.exports = {
    name: "serverinfo",
    description: "serverinfo",
    defaultPermission: 1,
    args: 0,
    guildOnly: true,
    execute(self, msg){
        msg.guild.fetchMembers().then((guild) => {
            let members = guild.memberCount;
            let channels = guild.channels;

            let textChannels = channels.filter((channel) => {
                return channel.type === "text";
            });

            let voiceChannels = channels.filter((channel) => {
                return channel.type === "voice";
            });

            let presences = guild.presences;
            console.log(presences);
            console.log(msg.guild.presences);
            let online = presences.filter((presence) => {
                return presence.status === "online";
            });

            let idle = presences.filter((presence) => {
                return presence.status === "idle";
            });

            let dnd = presences.filter((presence) => {
                return presence.status === "dnd";
            });

            let embed = new self.Discord.RichEmbed();
            embed.setTitle("=-=-=-=-= "+ guild.name +" =-=-=-=-=");
            embed.setColor("RED");
            embed.setFooter("Created at " + guild.createdAt, guild.iconURL);
            embed.setThumbnail(guild.iconURL);
            embed.addField(`Members (${online.size+idle.size+dnd.size}/${members})`, `<:online:313956277808005120> ${online.size}\n<:away:313956277220802560> ${idle.size}\n<:dnd:313956276893646850> ${dnd.size}\n<:offline:313956277237710868> ${members - (online.size + idle.size + dnd.size)}`, true);
            embed.addField("Total Roles", guild.roles.size, true);
            embed.addField("Owner", guild.owner.user.username + "#" + guild.owner.user.discriminator, true);
            embed.addField("Region", guild.region, true);
            embed.addField("Text Channels", textChannels.size, true);
            embed.addField("Voice Channels", voiceChannels.size, true);

            self.send(msg, embed);
        });
    }
};
