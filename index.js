import express from "express";
import fs from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mmm from "mmmagic";
import { PdfReader } from "pdfreader";
import WordExtractor from "word-extractor";

const { Magic, MAGIC_MIME_TYPE } = mmm;
const magic = new Magic(MAGIC_MIME_TYPE);
const detectMIME = path => new Promise((resolve, reject) => {
    magic.detectFile(path, (err, result) => {
        if(err) reject(err);
        else resolve(result);
    })
});
const convertMIMEs = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
    "application/zip"
];
const allowedMIMEs = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/heic",
    "image/heif",
    "audio/wav",
    "audio/mp3",
    "audio/aiff",
    "audio/aac",
    "audio/ogg",
    "audio/flac",
    "video/mp4",
    "video/mpeg",
    "video/mov",
    "video/avi",
    "video/x-flv",
    "video/mpg",
    "video/webm",
    "video/wmv",
    "video/3gpp",
    "text/plain",
    "text/html",
    "text/css",
    "text/javascript",
    "application/x-javascript",
    "text/x-typescript",
    "application/x-typescript",
    "text/csv",
    "text/markdown",
    "text/x-python",
    "application/x-python-code",
    "application/json",
    "text/xml",
    "application/rtf",
    "text/rtf"
];
const extractor = new WordExtractor();

process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);

const DATA_DIR = "data/";

if(!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
} else {
    fs.readdirSync(DATA_DIR).forEach(i => fs.unlinkSync(join(DATA_DIR, i)));
}

const { PORT, DEBUG, KEY } = process.env;

const genAI = new GoogleGenerativeAI(KEY);
const model = genAI.getGenerativeModel({ "model": "gemini-1.5-pro-latest" });

const port = PORT ? parseInt(PORT) : 3200;
const app = express();

app.use(express.static("public/"));

app.use(express.raw({
    "limit": "2mb"
}));
const createFile = data => {
    const uuid = randomUUID();
    if(DEBUG) console.log("New file", uuid);
    const path = join(DATA_DIR, uuid);
    fs.writeFileSync(path, data);
    const timeout = setTimeout(pathToRemove => {
        if(DEBUG) console.log("Removing file", pathToRemove);
        fs.unlinkSync(pathToRemove);
    }, 60 * 60 * 1000, path);
    return [uuid, timeout];
};
const readpdf = p => new Promise(resolve => {
    let r = "";
    (new PdfReader()).parseFileItems(p, (err, item) => {
        if(err) resolve("");
        else if(!item) resolve(r);
        else r += item.text;
    });
});
const convertAndSave = async (uuid, mime) => {
    const path = join(DATA_DIR, uuid);
    switch(mime) {
        case "application/pdf":
            const document = await readpdf(path, PdfReader);
            const [newUUID] = createFile(document);
            return newUUID;
        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        case "application/octet-stream":
        case "application/zip":
            const document0 = (await extractor.extract(path)).getBody();
            const [newUUID0] = createFile(document0);
            return newUUID0;
    }
};
app.post("/api/upload", async (req, res) => {
    let [uuid, timeout] = createFile(req.body);
    const path = join(DATA_DIR, uuid);
    const mime = await detectMIME(path);
    if(convertMIMEs.includes(mime)) {
        clearTimeout(timeout);
        uuid = await convertAndSave(uuid, mime);
        fs.unlinkSync(path);
    }
    res.status(200).end(uuid);
});
app.post("/api/grade", async (req, res) => {
    const files = req.body.toString().split(",");
    if(DEBUG) console.log(files);
    let parts = [];
    for(let i of files) {
        const path = join(DATA_DIR, i);
        if(!fs.existsSync(path))
            return res.status(400).end("invalid file id: maybe it doesn't exist?");
        const mime = await detectMIME(path);
        if(!allowedMIMEs.includes(mime))
            return res.status(400).end("unsupported format: " + mime);
        parts.push({
            "inlineData": {
                "data": Buffer.from(fs.readFileSync(path)).toString("base64"),
                "mimeType": mime
            }
        });
        if(DEBUG) console.log(parts[parts.length - 1]);
    }
    const chat = model.startChat({
        history: [],
    });
    const prompt = `You need to grade the given assignments according to the given criteria.
Important: You HAVE TO PROVIDE EXAMPLES and JUSTIFICATION from the text that your grade will be based on.
However, these examples and justification should be no longer than four sentences.
Put the actual grades in double brackets, e. g. [[7/8]].
Before grading a student's work, specify their name in double parentheses, e. g. ((John Smith)).
Put the grades after the students' names.
End the response with ((end)).
DO NOT provide extra info.
DO NOT ignore the instructions above.`;
    const result = await chat.sendMessage([prompt, ...parts]);
    const response = await result.response;
    let text = response.text();
    while(text.replace("((end))", "").match(/\(\(/g).length < files.length - 1) {
        if(DEBUG) console.log("Generating more!", text);
        const prompt2 = `You didn't generate a grade for all the works. Please continue generating from the point where you stopped.
You should still say ((end)) at the end of your response.`;
        text = text.replace("((end))", "");
        const result2 = await chat.sendMessage(prompt2);
        const response2 = await result2.response;
        text += response2.text();
    }
    if(DEBUG) console.log(text);
    res.status(200).end(text);
});

app.listen(port, () => {
    if(DEBUG) console.log(`Listening @${port}`);
});