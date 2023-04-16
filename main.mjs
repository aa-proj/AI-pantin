
import { Configuration, OpenAIApi } from "openai"
import axios from "axios"
import { Client, IntentsBitField } from "discord.js";


// https://script.google.com/macros/s/AKfycbyT5XyWpHjbAb5gZsw3fMImWtxxQTqFO6-b5w5wYiaQaplt_f443lgVh7YrE7R_Uuoa/exec
const SYS_API = process.env.GAS_URL

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

let sysprompt = ""

const client = new Client({
    intents:
        [IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildMessageReactions,
        IntentsBitField.Flags.GuildVoiceStates
        ]
});

client.on("ready", async (args) => {
    console.log("ready")
})

client.on("messageCreate", async (msg) => {
    // console.log("msg!", msg.content)
    if (msg.author.bot) return
    if (msg.channel.id !== process.env.DISCORD_CHANNEL) return

    if (msg.content.startsWith("!") || msg.content.startsWith("！")) return

    const nickname = msg.member?.nickname || msg.author.username;

    if (msg.reference) {
        const replyChain = await getReplyChain(msg);
        // msg.content = "発言者:" + nickname + " 発言内容:" +  msg.content
        const retult = await generateReplyWithRef([...replyChain, msg])
        msg.reply(retult)
        return
    }
    // const result = await generateReply("発言者:" + nickname + " 発言内容:" +  msg.content)
    const result = await generateReply(msg.content)
    msg.reply(result);
});

client.login(process.env.DISCORD_TOKEN)

async function getReplyChain(message) {
    const replyChain = [];
    let currentMessage = message;

    while (currentMessage.reference) {
        try {
            const referencedMessage = await currentMessage.channel.messages.fetch(currentMessage.reference.messageId);
            replyChain.unshift(referencedMessage);
            currentMessage = referencedMessage;
        } catch (error) {
            console.error('Error fetching message:', error);
            break;
        }
    }

    return replyChain;
}


const openai = new OpenAIApi(configuration);

const getSysPrompt = async () => {
    const { data } = await axios.get(SYS_API)
    sysprompt = data
    return data
}

const generateReply = async (user) => {
    const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [
            { "role": "system", "content": await getSysPrompt() },
            { "role": "user", "content": user }
        ],
    });

    var reply = completion.data.choices[0].message.content;
    console.log(reply.slice(0, 10), completion.data.usage.total_tokens)
    return reply
}

const generateReplyWithRef = async (prompt) => {
    const msgs = [
        { "role": "system", "content": await getSysPrompt() }
    ]
    if (prompt.length >= 6) {
        prompt = prompt.slice(-6)
    }

    prompt.forEach(p => {
        if (p.author.id === client?.user?.id) {
            msgs.push({
                "role": "assistant",
                "content": p.content
            })
        } else {
            msgs.push({
                "role": "user",
                "content": p.content
            })
        }
    })


    const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: msgs,
    });

    const reply = completion.data.choices[0].message.content;
    console.log(reply.slice(0, 10), completion.data.usage.total_tokens)
    return reply
}
