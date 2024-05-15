let criteria = "";
let submissions = [];

const toggleCriteriaVisibility = () => {
    document.querySelector("#criteria-empty").classList.toggle("hidden");
    document.querySelector("#criteria").classList.toggle("hidden");
};

const uploadOne = file => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = async e2 => {
        if(e2.target.readyState != FileReader.DONE) return;
        const f = await fetch("/api/upload", {
            "method": "POST",
            "body": e2.target.result,
            "headers": {
                "Content-Type": "application/octet-stream"
            }
        });
        if(f.status != 200) reject();
        resolve(f.text());
    };
    fr.readAsArrayBuffer(file);
});
const upload = async e => {
    const files = e.target.files;
    let o = [];
    if(!files || files.length == 0) reject();
    for(const file of files)
        o.push(await uploadOne(file));
    return o.join(",");
};

const removeSubmission = uuid => {
    document.querySelector(`[data-uuid='${uuid}']`).remove();
    submissions = submissions.filter(x => x != uuid);
};

/** @typedef {{ name: string, grade: string, explanation: string }} Analysis */
/** @type {Analysis[]} */
const analyze = async uuids => {
    if(typeof uuids !== "string")
        uuids = uuids.join(",");
    /** @type {Analysis[]} */
    let out = [];
    const f = await fetch("/api/grade", {
        "method": "POST",
        "body": uuids,
        "headers": {
            "Content-Type": "application/octet-stream"
        }
    });
    if(f.status != 200) throw new Error("can't grade assignment!");
    let text = await f.text();
    text = text.slice(text.indexOf("(("));
    while(text.includes("((")) {
        const nameStart = text.indexOf("((") + 2;
        const nameEnd = text.indexOf("))");
        const name = text.slice(nameStart, nameEnd);
        if(name == "end") return out;
        let nextNameStart = text.slice(nameStart).indexOf("((");
        if(nextNameStart == -1) nextNameStart = text.slice(nameStart).length;
        const grade = text.slice(0, nextNameStart).match(/(?<=\[\[)[^\]]+(?=]])/)?.[0];
        out.push({
            name: name,
            grade: grade,
            explanation: text.slice(nameEnd + 2, nextNameStart).replace(`[[${grade}]]`, "")
        });
        text = text.slice(nextNameStart);
    }
    return out;
};
const analyzeDisplay = async uuids => {
    if(typeof uuids === "object")
        uuids = `${criteria},${uuids.parentNode.getAttribute("data-uuid")}`;
    document.querySelector(".grader").replaceChildren();
    const res = await analyze(uuids);
    for(const i of res) {
        const card = document.createElement("div");
        card.classList.add("card");
        const nameAndGrade = document.createElement("div");
        nameAndGrade.classList.add("name-and-grade");
        const name = document.createElement("h1");
        name.classList.add("name");
        name.innerText = i.name;
        const grade = document.createElement("div");
        grade.classList.add("grade");
        grade.innerText = i.grade;
        nameAndGrade.appendChild(name);
        nameAndGrade.appendChild(grade);
        card.appendChild(nameAndGrade);
        const explanation = document.createElement("pre");
        explanation.innerText = i.explanation;
        explanation.style.textWrap = "pretty";
        card.appendChild(explanation);
        document.querySelector(".grader").appendChild(card);
    }
};
document.querySelector("#all").addEventListener("click", () => {
    const allFiles = `${criteria},${submissions.join(",")}`;
    analyzeDisplay(allFiles);
});

const uploadCriteria = async e => {
    criteria = await upload(e);
    document.querySelector("#criteria-name").innerText = e.target.files[0]?.name;
    toggleCriteriaVisibility();
};
document.querySelector("#criteria-upload").addEventListener("change", uploadCriteria);
const uploadSubmission = async e => {
    const uuids = (await upload(e)).split(",");
    for(const i of uuids)
        submissions.push(i);
    let i = 0;
    for(const file of e.target.files) {
        const submission = document.createElement("div");
        submission.classList.add("submission");
        submission.setAttribute("data-uuid", uuids[i]);
        const name = document.createElement("p");
        name.classList.add("submission-name");
        name.innerText = file.name;
        name.addEventListener("click", () => {
            analyzeDisplay(name);
        });
        submission.appendChild(name);
        const remove = document.createElement("md-icon");
        remove.classList.add("submission-remove");
        remove.innerText = "delete";
        remove.addEventListener("click", () => removeSubmission(uuids[i]));
        submission.appendChild(remove);
        document.querySelector("#submissions").appendChild(submission);
        i++;
    }
};
document.querySelector("#submission-upload").addEventListener("change", uploadSubmission);

const removeCriteria = () => {
    criteria = "";
    toggleCriteriaVisibility();
};
document.querySelector("#criteria-remove").addEventListener("click", removeCriteria);
