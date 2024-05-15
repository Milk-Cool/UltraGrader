import express from "express";
import fs from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mmm from "mmmagic";
import { pdf } from "pdf-to-img";

const { Magic, MAGIC_MIME_TYPE } = mmm;
const magic = new Magic(MAGIC_MIME_TYPE);
const detectMIME = path => new Promise((resolve, reject) => {
    magic.detectFile(path, (err, result) => {
        if(err) reject(err);
        else resolve(result);
    })
});
const convertMIMEs = [
    "application/pdf"
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
const convertAndSave = async uuid => {
    let out = [];
    const path = join(DATA_DIR, uuid);
    const document = await pdf(path, { scale: 3 });
    for await(const image of document) {
        const uuid = randomUUID();
        fs.writeFileSync(join(DATA_DIR, uuid), image);
        out.push(uuid);
    }
    return out.join(",");
};
app.post("/api/upload", async (req, res) => {
    let [uuid, timeout] = createFile(req.body);
    const path = join(DATA_DIR, uuid);
    const mime = await detectMIME(path);
    if(convertMIMEs.includes(mime)) {
        clearTimeout(timeout);
        uuid = await convertAndSave(uuid);
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
    const prompt = `You need to grade the given assignments according to the given criteria.
Important: You HAVE TO PROVIDE EXAMPLES and JUSTIFICATION from the text that your grade will be based on.`;
    const result = await model.generateContent([prompt, ...parts]);
    const response = await result.response;
    const text = response.text();
    if(DEBUG) console.log(text);
    res.status(200).end(text);
})

app.listen(port, () => {
    if(DEBUG) console.log(`Listening @${port}`);
});