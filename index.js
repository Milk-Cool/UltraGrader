import express from "express";
import fs from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const DATA_DIR = "data/";

if(!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
} else {
    fs.readdirSync(DATA_DIR).forEach(i => fs.unlinkSync(join(DATA_DIR, i)));
}

const { PORT, DEBUG } = process.env;
const port = PORT ? parseInt(PORT) : 3200;
const app = express();

app.use(express.static("public/"));

app.use(express.raw({
    "type": "*/*",
    "limit": "20mb"
}));
app.post("/api/upload", (req, res) => {
    const uuid = randomUUID();
    if(DEBUG) console.log("New file", uuid);
    fs.writeFileSync(join(DATA_DIR, uuid), req.body);
    res.status(200).end(uuid);
});

app.listen(port, () => {
    if(DEBUG) console.log(`Listening @${port}`);
});