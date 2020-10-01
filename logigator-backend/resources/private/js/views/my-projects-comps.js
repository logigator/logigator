function projectComponentList() {
	const popupContainer = document.querySelector('.view-my-projects-comps__popup-container');
	const pageContainer = document.querySelector('.view-my-projects-comps__list');
	const pageButtons = document.querySelectorAll('.view-my-projects-comps__page-button');
	const pageButtonTargets = [0, 0, 0, 0, 0, 0, 0];

	let searchTerm;
	let currentPage;

	function updatePagination() {
		const projectCompList = document.querySelector('.partial-project-comp-list');
		const totalPages = Number(Bem.data(projectCompList, 'total-pages'));
		currentPage = Number(Bem.data(projectCompList, 'current-page'));

		pageButtonTargets[0] = currentPage > 0 ? 0 : undefined;
		pageButtonTargets[1] = currentPage > 0 ? currentPage - 1 : undefined;

		pageButtonTargets[2] = undefined;
		pageButtonTargets[3] = undefined;
		pageButtonTargets[4] = undefined;

		let from;
		let to;
		if (currentPage === 0) {
			from = 0;
			to = totalPages > 3 ? 3 : totalPages - 1;
		} else if (currentPage === totalPages - 1) {
			from = Math.max(totalPages - 3, 0);
			to = totalPages - 1;
		} else {
			from = currentPage - 1;
			to = currentPage + 1;
		}
		for (let page = from, i = 2; page <= to; page++, i++) {
			pageButtonTargets[i] = page;
		}

		pageButtonTargets[5] = currentPage < totalPages - 1 ? currentPage + 1 : undefined;
		pageButtonTargets[6] = currentPage < totalPages - 1 ? totalPages - 1 : undefined;


		pageButtons.forEach((button, index) => {
			if (index <= 1 || index >= 5) {
				button.disabled = pageButtonTargets[index] === undefined;
			} else {
				Bem.setState(button, 'hidden', pageButtonTargets[index] === undefined);
				Bem.setState(button, 'active', pageButtonTargets[index] === currentPage);
				button.innerHTML = pageButtonTargets[index] + 1;
			}
		});

	}

	function addPageButtonListeners() {
		pageButtons.forEach((button, index) => {
			button.addEventListener('click', () => {
				if (pageButtonTargets[index] !== undefined && !Bem.hasState(button, 'active')) {
					navigate(pageButtonTargets[index], searchTerm);
				}
			});
		});
	}

	function addSearchListener() {
		const searchInput = document.getElementById('view-my-projects-comps__search');
		const debouncedListener = debounceFunction(() => {
			searchTerm = searchInput.value;
			navigate(0, searchTerm);
		}, 400);
		searchInput.addEventListener('input', debouncedListener);
	}

	async function navigate(page, search) {
		const params = {
			page
		};
		if (search !== undefined && search !== '') {
			params.search = search;
		}

		const searchParams = new URLSearchParams(params).toString();
		const resp = await fetch('/my/projects/page?' + searchParams);
		pageContainer.innerHTML = await resp.text();

		const baseUrl = [location.protocol, '//', location.host, location.pathname].join('');
		window.history.pushState({}, '', baseUrl + '?' + searchParams);
		updatePagination();
		addInteractionButtonListeners(pageContainer);
	}

	function addInteractionButtonListeners() {
		pageContainer.querySelectorAll('.partial-project-comp-list__icon-info').forEach(button => {
			button.addEventListener('click', () => {
				const id = button.parentElement.getAttribute('data-id');
				openDynamicPopup(`/my/projects/info/${id}`, popupContainer);
			});
		});
		pageContainer.querySelectorAll('.partial-project-comp-list__icon-edit').forEach(button => {
			button.addEventListener('click', () => {
				const id = button.parentElement.getAttribute('data-id');
				openDynamicPopup(`/my/projects/edit-popup/${id}`, popupContainer);
			});
		});
		pageContainer.querySelectorAll('.partial-project-comp-list__icon-new').forEach(button => {
			button.addEventListener('click', () => {
				openDynamicPopup('/my/projects/create-popup', popupContainer);
			});
		});
	}

	updatePagination();
	addPageButtonListeners();
	addSearchListener();
	addInteractionButtonListeners();
}
projectComponentList();
