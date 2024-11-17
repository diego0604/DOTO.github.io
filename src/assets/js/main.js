import { loadTasks, renderTasks, saveTasks, setupDragAndDrop, saveTaskChanges } from "./tasks.js";
import { loadCategories, renderCategories, renderCategoryList, addCategory } from "./categories.js";

document.addEventListener("DOMContentLoaded", () => {
    const tasks = loadTasks();

    renderTasks(tasks);
    renderCategories(loadCategories());
    renderCategoryList(loadCategories());
    setupDragAndDrop(tasks);

    document.getElementById("taskForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const name = document.getElementById("taskName").value.trim();
        const description = document.getElementById("taskDescription").value.trim();
        const category = document.getElementById("taskCategory").value;

        if (!name || !category) {
            Swal.fire({ title: "Error", text: "Completa todos los campos.", icon: "error", confirmButtonText: "Aceptar" });
            return;
        }

        const taskExists = tasks.some(
            (task) =>
                task.name.toLowerCase() === name.toLowerCase() &&
                task.category === category &&
                task.status !== "culminada"
        );

        if (taskExists) {
            Swal.fire({ title: "Error", text: "La tarea ya existe en un estado activo.", icon: "error", confirmButtonText: "Aceptar" });
            return;
        }

        tasks.push({ id: Date.now().toString(), name, description, category, status: "nueva" });
        saveTasks(tasks);
        renderTasks(tasks);
        setupDragAndDrop(tasks);
        Swal.fire({ title: "Éxito", text: "Tarea creada correctamente.", icon: "success", confirmButtonText: "Aceptar" });
        e.target.reset();
    });

    document.getElementById("categoryForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const newCategory = document.getElementById("newCategory").value.trim();

        if (newCategory.length > 10) {
            Swal.fire({ title: "Error", text: "Máximo 10 caracteres.", icon: "error", confirmButtonText: "Aceptar" });
            return;
        }

        const currentCategories = loadCategories();
        addCategory(currentCategories, newCategory);
        renderCategories(loadCategories());
        renderCategoryList(loadCategories());
        e.target.reset();
    });

    document.getElementById("taskEditForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const taskId = e.target.dataset.taskId;
        const updatedData = {
            name: document.getElementById("editTaskName").value.trim(),
            description: document.getElementById("editTaskDescription").value.trim(),
            category: document.getElementById("editTaskCategory").value.trim(),
        };

        if (!updatedData.name || !updatedData.category) {
            Swal.fire({ title: "Error", text: "Completa los campos obligatorios.", icon: "error", confirmButtonText: "Aceptar" });
            return;
        }

        saveTaskChanges(tasks, taskId, updatedData);
        bootstrap.Modal.getInstance(document.getElementById("taskInfoModal")).hide();
        renderTasks(tasks); // Asegurarnos de refrescar las tareas actualizadas
    });
});
