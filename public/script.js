let criteria = "";
let submissions = [];

const toggleCriteriaVisibility = () => {
    document.querySelector("#criteria-empty").classList.toggle("hidden");
    document.querySelector("#criteria").classList.toggle("hidden");
}

const uploadCriteria = e => {
    const files = e.target.files;
    if(!files || files.length == 0) return;
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
        if(f.status != 200) return;
        criteria = await f.text();
        document.querySelector("#criteria-name") = file.name;
        toggleCriteriaVisibility();
    };
    fr.readAsArrayBuffer(file);
};

document.querySelector("#criteria-upload").addEventListener("change", uploadCriteria);