import { loadCategories } from "./categories.js";

const TASKS_KEY = "tasks";

export function loadTasks() {
    return JSON.parse(localStorage.getItem(TASKS_KEY)) || [];
}

export function saveTasks(tasks) {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

export function renderTasks(tasks) {
    const states = ["nueva", "en progreso", "culminada", "aplazada"];

    states.forEach((state) => {
        const taskList = document.getElementById(`${state}Tasks`);
        if (!taskList) return;
        taskList.innerHTML = "";

        tasks.filter((task) => task.status === state).forEach((task) => {
            const taskDiv = document.createElement("div");
            taskDiv.className = `task`;
            taskDiv.setAttribute("draggable", "true");
            taskDiv.dataset.id = task.id;

            if (task.status === "en progreso") {
                taskDiv.style.backgroundColor = "#fff3cd";
                taskDiv.style.borderColor = "#ffecb5";
                taskDiv.style.color = "#000";
            } else if (task.status === "culminada") {
                taskDiv.style.backgroundColor = "#d4edda";
                taskDiv.style.borderColor = "#c3e6cb";
            } else if (task.status === "aplazada") {
                taskDiv.style.backgroundColor = "#f8d7da";
                taskDiv.style.borderColor = "#f5c6cb";
            }

            taskDiv.innerHTML = `
                <strong>${task.name}</strong>
                <span>${task.description}</span>
                <small>Categoría: ${task.category}</small>
            `;

            taskDiv.addEventListener("click", () => showTaskModal(task));

            taskDiv.addEventListener("dragstart", (e) => {
                if (task.status === "culminada") {
                    e.preventDefault();
                    Swal.fire("Aviso", "No se puede mover una tarea completada.", "info");
                } else {
                    e.dataTransfer.setData("text/plain", task.id);
                    taskDiv.classList.add("dragging");
                }
            });

            taskDiv.addEventListener("dragend", () => taskDiv.classList.remove("dragging"));

            taskList.appendChild(taskDiv);
        });
    });
}

export function showTaskModal(task) {
    const modal = new bootstrap.Modal(document.getElementById("taskInfoModal"));
    const taskEditForm = document.getElementById("taskEditForm");
    const categories = loadCategories();

    document.getElementById("displayTaskName").textContent = task.name;
    document.getElementById("displayTaskDescription").textContent = task.description;
    document.getElementById("displayTaskCategory").textContent = task.category;
    document.getElementById("displayTaskStatus").textContent = task.status;

    if (!categories.includes(task.category)) {
        Swal.fire({
            title: "Advertencia",
            text: `La categoría "${task.category}" ya no existe. 
            significa que si modificas la categoría, entonces no podrás volver los cambios.`,
            icon: "warning",
            confirmButtonText: "Aceptar",
        }).then(() => {
            document.getElementById("editTaskButton").click();
        });
    }

    document.getElementById("editTaskButton").onclick = () => {
        if (task.status === "culminada") {
            Swal.fire("Aviso", "No puedes editar una tarea completada.", "info");
            return;
        }

        document.getElementById("editTaskName").value = task.name;
        document.getElementById("editTaskDescription").value = task.description;
        document.getElementById("editTaskCategory").value = task.category;
        taskEditForm.dataset.taskId = task.id;

        document.getElementById("taskDisplayMode").classList.add("d-none");
        taskEditForm.classList.remove("d-none");
    };

    document.getElementById("taskDisplayMode").classList.remove("d-none");
    taskEditForm.classList.add("d-none");

    modal.show();
}

export function saveTaskChanges(tasks, id, updatedData) {
    const taskIndex = tasks.findIndex((task) => task.id === id);
    if (taskIndex === -1) return;

    tasks[taskIndex] = { ...tasks[taskIndex], ...updatedData };
    saveTasks(tasks);
    renderTasks(tasks);

    Swal.fire("Éxito", "Tarea actualizada correctamente.", "success");
}

export function setupDragAndDrop(tasks) {
    const columns = document.querySelectorAll(".task-list");

    columns.forEach((column) => {
        column.addEventListener("dragover", (e) => {
            e.preventDefault();
            const dragging = document.querySelector(".dragging");
            if (dragging) column.appendChild(dragging);
        });

        column.addEventListener("drop", (e) => {
            e.preventDefault();
            const taskId = e.dataTransfer.getData("text/plain");
            const task = tasks.find((t) => t.id === taskId);
            const newStatus = column.id.replace("Tasks", "").toLowerCase();

            if (!task) return;

            if (newStatus === "culminada") {
                Swal.fire({
                    title: "¿Estás seguro?",
                    text: "Esta tarea será marcada como completada.",
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonText: "Sí, completar",
                    cancelButtonText: "Cancelar",
                }).then((result) => {
                    if (result.isConfirmed) {
                        task.status = newStatus;
                        saveTasks(tasks);
                        renderTasks(tasks);
                    }
                });
            } else {
                task.status = newStatus;
                saveTasks(tasks);
                renderTasks(tasks);
            }
        });
    });
}
