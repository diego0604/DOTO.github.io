const CATEGORIES_KEY = "categories";

export function loadCategories() {
    const defaultCategories = ["Estudio", "Trabajo"];
    const savedCategories = JSON.parse(localStorage.getItem(CATEGORIES_KEY)) || [];
    return [...new Set([...defaultCategories, ...savedCategories])];
}

export function saveCategories(categories) {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

export function renderCategories(categories) {
    const categorySelects = [document.getElementById("taskCategory"), document.getElementById("editTaskCategory")];
    categorySelects.forEach((select) => {
        if (!select) return;
        select.innerHTML = '<option value="" disabled selected>Selecciona una Categoría</option>';
        categories.forEach((category) => {
            const option = document.createElement("option");
            option.value = category;
            option.textContent = category;
            select.appendChild(option);
        });
    });
}

export function renderCategoryList(categories) {
    const categoryList = document.getElementById("categoryList");
    if (!categoryList) return;
    categoryList.innerHTML = "";

    categories.forEach((category) => {
        const li = document.createElement("li");
        li.className = "list-group-item d-flex justify-content-between align-items-center";
        li.textContent = category;

        if (!["Estudio", "Trabajo"].includes(category)) {
            const deleteButton = document.createElement("button");
            deleteButton.className = "btn btn-danger btn-sm";
            deleteButton.textContent = "Eliminar";
            deleteButton.onclick = () => {
                removeCategory(category, categories);
            };
            li.appendChild(deleteButton);
        }

        categoryList.appendChild(li);
    });
}

function removeCategory(category, categories) {
    console.log(categories);
    console.log(category);
    const updatedCategories = categories.filter((c) => c !== category);
    console.log(updatedCategories);
    saveCategories(updatedCategories);
    renderCategories(updatedCategories);
    renderCategoryList(updatedCategories);

    Swal.fire({
        title: "Categoría Eliminada",
        text: `La categoría "${category}" fue eliminada correctamente.`,
        icon: "success",
        confirmButtonText: "Aceptar",
    });
}

export function addCategory(categories, newCategory) {
    console.log(categories);
    if (categories.length >= 6) {
        Swal.fire("Error", "No puedes agregar más de 6 categorías.", "error");
        return;
    }

    if (categories.includes(newCategory)) {
        Swal.fire("Error", "Esta categoría ya existe.", "error");
        return;
    }

    categories.push(newCategory);
    saveCategories(categories);
    renderCategories(categories);
    renderCategoryList(categories);

    Swal.fire({
        title: "Categoría Agregada",
        text: `La categoría "${newCategory}" fue agregada exitosamente.`,
        icon: "success",
        confirmButtonText: "Aceptar",
    });
}
