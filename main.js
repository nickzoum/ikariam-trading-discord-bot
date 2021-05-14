const discord = require("discord.js");
const channelID = process.env.channelID;
const token = process.env.token;
const client = new discord.Client({});
const goldBot = 5, goldTop = 10;
const errorTimeout = 15E3;

const resources = {
    "Wood": ["BM"],
    "Wine": ["W"],
    "Stone": ["M"],
    "Crystal": ["C"],
    "Sulphur": ["S"]
};

const modes = { offers: "offers", wants: "wants" };

var fullData = {
    "CTs": {},
    "Friend Slots": {},
    "Buying": {},
    "Selling": {},
    "Trading": {},
    "Open Trades": {},
    "Black Market": {}
}, lastMessage, isReady;

var stringify = {
    "CTs": function (count) { return count; },
    "Friend Slots": function (count) { return count; },
    "Buying": function (item) {
        return Object.entries(item).map(function ([type, description]) {
            return `\n>    **${description.amount}** **${type}** at **${description.start}${description.stop ? "- " + description.stop : ""}g**`;
        }).join("");
    },
    "Selling": function (item) {
        return Object.entries(item).map(function ([type, description]) {
            return `\n>    **${description.amount}** **${type}** at **${description.start}${description.stop ? "-" + description.stop : ""}g**`;
        }).join("");
    },
    "Trading": function (item) {
        return Object.entries(item).map(function ([desiredType, description]) {
            return `\n>    Wants **${description.amount}** **${desiredType}** in exchange for **${description.otherAmount}** **${description.otherType}**`;
        }).join("");
    },
    "Open Trades": function (item) {
        return Object.entries(item).map(function ([type, description]) {
            return `\n>    ${description.mode} **${description.amount}** **${type}**`;
        }).join("");
    },
    "Black Market": function (item) {
        return Object.entries(item).map(function ([location, level]) {
            return `\n>    [${location}]: ${level}`;
        }).join("");
    }
};

var parse = {
    "CTs": function (text) { return text.replace(/\s/g, "") | 0; },
    "Friend Slots": function (text) { return text.replace(/\s/g, "") | 0; },
    "Buying": function (text) {
        var list = (text || "").split(/\s*>\s+/).slice(1);
        return list.reduce(function (output, text) {
            var result = /\*\*(\d+)\*\*\s+\*\*(\w+)\*\*\s+at\s+\*\*(\d+)(?:-(\d+))?g\*\*/.exec(text);
            if (!result) return output;
            var [, amount, type, start, stop] = result;
            output[type] = { amount: amount, start: start, stop: stop || 0 };
            return output;
        }, {});
    },
    "Selling": function (text) {
        var list = (text || "").split(/\s*>\s+/).slice(1);
        return list.reduce(function (output, text) {
            var result = /\*\*(\d+)\*\*\s+\*\*(\w+)\*\*\s+at\s+\*\*(\d+)(?:-(\d+))?g\*\*/.exec(text);
            if (!result) return output;
            var [, amount, type, start, stop] = result;
            output[type] = { amount: amount, start: start, stop: stop || 0 };
            return output;
        }, {});
    },
    "Trading": function (text) {
        var list = (text || "").split(/\s*>\s+/).slice(1);
        return list.reduce(function (output, text) {
            var result = /\w+\s+\*\*(\d+)\*\*\s+\*\*(\w+)\*\*[\w\s]+\*\*(\d+)\*\*\s+\*\*(\w+)\*\*/.exec(text);
            if (!result) return output;
            var [, amount, desiredType, otherAmount, otherType] = result;
            output[desiredType] = { amount, otherAmount, otherType };
            return output;
        }, {});
    },
    "Open Trades": function (text) {
        var list = (text || "").split(/\s*>\s+/).slice(1);
        return list.reduce(function (output, text) {
            var result = /(\w+)\s+\*\*(\d+)\*\*\s+\*\*(\w+)\*\*/.exec(text);
            if (!result) return output;
            var [, mode, amount, type] = result;
            if (!(mode in modes)) return output;
            output[type] = { amount, mode };
            return output;
        }, {});
    },
    "Black Market": function (text) {
        var list = (text || "").split(/\s*>\s+/).slice(1);
        return list.reduce(function (output, text) {
            var result = /\[(\d+:\d+)\]:\s*(\d+)/.exec(text);
            if (!result) return output;
            var [, location, level] = result;
            output[location] = level;
            return output;
        }, {});
    }
};

const commands = {
    "(\\d+)\\s*(?:fs|friend\\s*slots?)": function (count) {
        count = count | 0;
        if (count < 1) return "Didn't define amount";
        fullData["Friend Slots"][this.nickname || this.user.username] = count;
        return true;
        //    return `${this.username} has ${count} free friend slot${count - 1 ? "s" : ""} (${count}fs)`;
    },
    "(\\d+)\\s*ct": function (count) {
        count = count | 0;
        if (count < 1) return "Didn't define amount";
        fullData["CTs"][this.nickname || this.user.username] = count;
        return true;
        //   return `${this.username} has ${count} free cultural treat${count - 1 ? "ies" : "y"} (${count}ct)`;
    },
    "WTS\\s+(\\d+)(k?)\\s*(\\w+)\\s*(?:(?:for|at)\\s+)?(\\d+)\\s*(?:-\\s*(\\d+)\\s*)?g?": function (count, thousand, type, start, stop) {
        count = count | 0;
        start = start | 0;
        stop = stop | 0;
        if (count < 1) return "Didn't define amount";
        if (start < goldBot || start > goldTop) return "Invalid gold value";
        if (stop < goldBot || stop > goldTop) stop = 0;
        if (thousand) count *= 1E3;
        type = type.toLowerCase();
        type = Object.keys(resources).find(name => resources[name].includes(type));
        if (!type) return "Didn't define type";
        var username = this.nickname || this.user.username;
        fullData["Selling"][username] = fullData["Selling"][username] || {};
        fullData["Selling"][username][type] = { amount: count, start: start, stop: stop };
        return true;
        //   return `${this.username} want to sell ${count} ${type} at ${start}${stop ? "- " + stop : ""}g`;
    },
    "WTB\\s+(\\d+)(k?)\\s*(\\w+)\\s*(?:(?:for|at)\\s+)?(\\d+)\\s*(?:-\\s*(\\d+)\\s*)?g?": function (count, thousand, type, start, stop) {
        count = count | 0;
        start = start | 0;
        stop = stop | 0;
        if (count < 1) return "Didn't define amount";
        if (start < goldBot || start > goldTop) return "Invalid gold value";
        if (stop < goldBot || stop > goldTop) stop = 0;
        if (thousand) count *= 1E3;
        type = type.toLowerCase();
        type = Object.keys(resources).find(name => resources[name].includes(type));
        if (!type) return "Didn't define type";
        var username = this.nickname || this.user.username;
        fullData["Buying"][username] = fullData["Buying"][username] || {};
        fullData["Buying"][username][type] = { amount: count, start: start, stop: stop };
        return true;
        //     return `${this.username} want to buy ${count} ${type} at ${start}${stop ? "- " + stop : ""}g`;
    },
    "WTT\\s+(\\d+)(k?)\\s*(\\w+)\\s+(?:for\\s+)?(\\d+)(k?)\\s*(\\w+)": function (count, thousand, type, desiredCount, desiredThousand, desiredType) {
        count = count | 0;
        desiredCount = desiredCount | 0;
        if (count < 1) return "Didn't define amount";
        if (desiredCount < 1) return "Didn't define desired amount";
        if (thousand) count *= 1E3;
        if (desiredThousand) desiredCount *= 1E3;
        type = type.toLowerCase();
        type = Object.keys(resources).find(name => resources[name].includes(type));
        desiredType = desiredType.toLowerCase();
        desiredType = Object.keys(resources).find(name => resources[name].includes(desiredType));
        if (!type) return "Didn't define type";
        if (!desiredType) return "Didn't define desired type";
        if (type === desiredType) return `Can't trade ${type} for ${desiredType}`;
        if (Math.max(count / desiredCount, desiredCount / count) > 1.5) return "Difference in amount is too large";
        var username = this.nickname || this.user.username;
        fullData["Trading"][username] = fullData["Trading"][username] || {};
        fullData["Trading"][username][desiredType] = { amount: desiredCount, otherType: type, otherAmount: count };
        return true;
    },
    "tw\\s+(\\d+)(k?)\\s*(\\w+)": function (count, thousand, type) {
        count = count | 0;
        if (count < 1) return "Didn't define amount";
        if (thousand) count *= 1E3;
        type = type.toLowerCase();
        type = Object.keys(resources).find(name => resources[name].includes(type));
        if (!type) return "Didn't define type";
        var username = this.nickname || this.user.username;
        fullData["Open Trades"][username] = fullData["Open Trades"][username] || {};
        fullData["Open Trades"][username][type] = { amount: count, mode: modes.wants };
        return true;
    },
    "to\\s+(\\d+)(k?)\\s*(\\w+)": function (count, thousand, type) {
        count = count | 0;
        if (count < 1) return "Didn't define amount";
        if (thousand) count *= 1E3;
        type = type.toLowerCase();
        type = Object.keys(resources).find(name => resources[name].includes(type));
        if (!type) return "Didn't define type";
        var username = this.nickname || this.user.username;
        fullData["Open Trades"][username] = fullData["Open Trades"][username] || {};
        fullData["Open Trades"][username][type] = { amount: count, mode: modes.offers };
        return true;
    },
    "bm\\s+(\\d+)\\s*:\\s*(\\d+)\\s+(?:lvl)?\\s*(\\d+)?": function (x, y, level) {
        x = x | 0;
        y = y | 0;
        level = level | 0;
        if (!x || x > 99) return `Invalid X "${x}"`;
        if (!y || y > 99) return `Invalid Y "${y}"`;
        var username = this.nickname || this.user.username;
        fullData["Black Market"][username] = fullData["Black Market"][username] || {};
        fullData["Black Market"][username][`${x}:${y}`] = level;
        if (!level) delete fullData["Black Market"][username][`${x}:${y}`];
        if (!Object.keys(fullData["Black Market"][username]).length) delete fullData["Black Market"][username];
        return true;
    },
    "clear(?:\\s*(fs|ct|wts|wtb|wtt|all|bm|tw|to|\\*))?": function (clearMode) {
        var shortcuts = {
            "fs": "Friend Slots",
            "ct": "CTs",
            "wts": "Selling",
            "wtb": "Buying",
            "wtt": "Trading",
            "tw": "Open Trades",
            "to": "Open Trades",
            "bm": "Black Market"
        };
        var username = this.nickname || this.user.username;
        if (!clearMode || !(clearMode in shortcuts)) Object.keys(shortcuts).forEach(clear);
        else clear(clearMode);
        return true;

        function clear(type) {
            delete fullData[shortcuts[type]][username];
        }
    }
};

Object.entries(resources).forEach(function ([name, list]) {
    resources[name] = [name, ...list].map(text => text.toLowerCase());
});

client.addListener("ready", function () {
    console.log("Bot is running");
    setupChannel();
});

client.addListener("guildCreate", function () {
    if (isReady) return;
    console.log("Joined new server");
    setupChannel();
});

client.addListener("message", function (message) {
    if (!isReady || channelID !== message.channel.id) return;
    readMessage(message);
    printLargeMessage();
});

client.login(token);

function setupChannel() {
    if (!isReady) console.log("Searching for channel (" + channelID + ")");
    client.channels.fetch(channelID).then(function (channel) {
        if (!isReady) console.log("Found channel");
        if (!isReady) console.log("Reading messages...");
        channel.messages.fetch().then(function (list) {
            if (isReady) {
                list.forEach(readMessage);
                printLargeMessage();
                console.log("Read all messages");
                return;
            }
            list.forEach(function (message) {
                if (message.author.id === client.user.id) {
                    if (lastMessage) lastMessage.delete();
                    lastMessage = message;
                }
            });
            if (lastMessage) {
                readOldMessage(lastMessage.content);
                isReady = true;
                setupChannel(channel);
            } else {
                channel.send(createLargeMessage()).then(function (message) {
                    isReady = true;
                    lastMessage = message;
                    setupChannel(channel);
                });
            }
        }).catch(function (err) {
            console.error("Failed to read messages");
            console.error(err);
        });
    }).catch(function (err) {
        console.error("Couldn't find channel");
        console.error(err);
    });
}

function readMessage(message) {
    if (!message.member) {
        message.guild.members.fetch(message.author.id).then(function (member) {
            if (!member.nickname || message.author.username === member.nickname) return;
            Object.values(fullData).forEach(function (data) {
                if (!data[message.author.username]) return;
                if (!data[member.nickname]) data[member.nickname] = data[message.author.username];
                delete data[message.author.username];
            });
            printLargeMessage();
        });
    }
    var text = message.content, member = message.member || { user: message.author };
    if (typeof text !== "string" || !text || member.user.bot) return;
    for (var key in commands) {
        var result = new RegExp("^\\s*" + key + "\\s*$", "gi").exec(text);
        if (result && result[0]) {
            var output = commands[key].apply(member, [].slice.call(result, 1));
            if (output) {
                if (typeof output === "string") {
                    message.channel.send(`Error with command "**${text}**": ${output}`).then(function (errorMessage) {
                        setTimeout(function () {
                            errorMessage.delete();
                        }, errorTimeout);
                    });
                }
                message.delete();
                return;
            }
        }
    }
    message.delete();
    message.channel.send(`Invalid command "**${text}**"`).then(function (errorMessage) {
        setTimeout(function () {
            errorMessage.delete();
        }, errorTimeout);
    });
}

function readOldMessage(message) {
    var type = null;
    var infoList = message.split(/__\*\*Trades\*\*__:\s*/);
    message = infoList[1] || infoList[2];
    var list = message.split(/\s*__([^*_]+)__/).slice(1);
    list.forEach(function (text) {
        if (!type) return type = text, void 0;
        var users = text.split(/\s*>\s(?=[^\s])/).slice(1);
        users.forEach(function (user) {
            var data = user.split(":");
            var userName = data.shift();
            data = data.join(":");
            fullData[type][userName] = parse[type](data);
        });
        type = null;
    });
}

function printLargeMessage() {
    lastMessage.edit(createLargeMessage());
}

function createLargeMessage() {
    return `__**Trading Bot commands**__:
> CT: \` 5 ct \` or \` 4ct \`
> FS: \` 5 fs \` or \`3 friend slots \` or \` 3friendslot \`
> Selling: \` wts 5k wine for 5-8g \` or \` wts 5000 w 12g \` or \` wts 50k bm at 6g \`
> Buying: \` wtb 5k wine for 5-8g \` or \` wtb 5000 w 12g \` or \` wtb 50k bm at 6g \`
> Trading: \` wtt 5k wine for 5k sulphur \` or \` wtt 5k w 5000 s \` (\` wtt _what you have_ for _what you want_ \`)
> Open Trades: \` tw 5k wine \` or \` to 5000 w \`
> Black Market: \` bm 59:45 lvl 23  \` or \` bm 59:45 23  \`
> Clear: \` clear \` or \` clear all \` or \` clear wts \` or \` clear fs \`
__**Material shortcuts**__:
> Wood: \` BM \`
> Wine: \` W \`
> Stone: \` M \`
> Crystal: \` C \`
> Sulphur: \` S \`
__**Trades**__:
` + Object.entries(fullData).map(function ([category, users]) {
        var text = "__" + category + "__";
        Object.entries(users).forEach(function ([userName, data]) {
            text += "\n> " + userName + ": " + stringify[category](data);
        });
        return text;
    }).join("\n");
}