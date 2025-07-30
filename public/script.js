document.addEventListener("DOMContentLoaded", () => {
    const academicContainer = document.getElementById("academic-container");
    const addBtn = document.getElementById("add-academic");

    function isCurrentEntryFilled(entry) {
        const inputs = entry.querySelectorAll("input");
        return Array.from(inputs).every(input => input.value.trim() !== "");
    }

    function createAcademicEntry() {
    const newEntry = document.createElement("div");

        newEntry.innerHTML = `
            <div class="academic-block">
                <p class="academic-heading">Additional Academic Entry</p>
                <div class="details academic-entry">
                    <p><label>College/School : </label><input type="text" name="institution" required placeholder="Eg: KL University"></p>
                    <p><label>Major Degree : </label><input type="text" name="major" required placeholder="Eg: Computer Science and Engineering"></p>
                    <p><label>Year Started : </label><input type="number" name="ystart" required placeholder="Eg: 1950" min="1950" max="3000"></p>
                    <p><label>Year Completed : </label><input type="number" name="ycomp" required placeholder="Eg: 2026" min="1950" max="3000"></p>
                    <p><label>Score in(%) : </label><input type="number" name="score" required placeholder="Eg: 92%" min="0" max="100"></p>
                    <p><label>Number of Backlogs : </label><input type="number" name="backlog" required placeholder="Eg: 0" min="0" max="80"></p>
                </div>
                <button type="button" class="remove-btn">Remove</button>
            </div>
        `;

        const removeBtn = newEntry.querySelector(".remove-btn");
        removeBtn.addEventListener("click", () => {
            newEntry.remove();
        });

        return newEntry;
    }


    addBtn.addEventListener("click", () => {
        const entries = document.querySelectorAll(".academic-entry");
        const lastEntry = entries[entries.length - 1];
        if (!isCurrentEntryFilled(lastEntry)) {
            alert("Please fill out the current academic entry before adding a new one.");
            return;
        }

        const newEntry = createAcademicEntry();
        academicContainer.appendChild(newEntry);
    });

    // Ensure at least one checkbox per section is selected before submit
    document.querySelector("form").addEventListener("submit", function (e) {
        const checkboxGroups = [
            "countries[]",
            "programs[]",
            "level[]",
            "referral[]"
        ];

        for (let name of checkboxGroups) {
            const checkboxes = document.querySelectorAll(`input[name="${name}"]`);
            const anyChecked = Array.from(checkboxes).some(cb => cb.checked || (cb.type === "text" && cb.value.trim() !== ""));
            if (!anyChecked) {
                alert(`Please select at least one option from ${name.replace("[]", "")}`);
                e.preventDefault();
                return;
            }
        }
    });
});
