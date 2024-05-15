let criteria = "";
let submissions = [];

const toggleCriteriaVisibility = () => {
    document.querySelector("#criteria-empty").classList.toggle("hidden");
    document.querySelector("#criteria").classList.toggle("hidden");
}

const upload = e => new Promise((resolve, reject) => {
    const files = e.target.files;
    if(!files || files.length == 0) reject();
    const file = files[0];
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

const removeSubmission = uuid => {
    document.querySelector(`[data-uuid='${uuid}']`).remove();
    submissions = submissions.filter(x => x != uuid);
}

const uploadCriteria = async e => {
    criteria = await upload(e);
    document.querySelector("#criteria-name").innerText = e.target.files[0]?.name;
    toggleCriteriaVisibility();
};
document.querySelector("#criteria-upload").addEventListener("change", uploadCriteria);
const uploadSubmission = async e => {
    const uuid = await upload(e);
    submissions.push(uuid);

    const submission = document.createElement("div");
    submission.classList.add("submission");
    submission.setAttribute("data-uuid", uuid);
    const name = document.createElement("p");
    name.classList.add("submission-name");
    name.innerText = e.target.files[0]?.name;
    submission.appendChild(name);
    const remove = document.createElement("md-icon");
    remove.classList.add("submission-remove");
    remove.innerText = "delete";
    remove.addEventListener("click", () => removeSubmission(uuid));
    submission.appendChild(remove);
    document.querySelector("#submissions").appendChild(submission);
};
document.querySelector("#submission-upload").addEventListener("change", uploadSubmission);

const removeCriteria = () => {
    criteria = "";
    toggleCriteriaVisibility();
};
document.querySelector("#criteria-remove").addEventListener("click", removeCriteria);
