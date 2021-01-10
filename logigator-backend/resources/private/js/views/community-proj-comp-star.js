function communityProjCompStar() {
	const pageType = document.querySelector('.view-community-proj-comp-star').getAttribute('data-type');
	const link = document.querySelector('.view-community-proj-comp-star').getAttribute('data-link');
	const pageContainer = document.querySelector('.view-community-proj-comp-star__list');
	const pageButtons = document.querySelectorAll('.view-community-proj-comp-star__page-button');
	const pageButtonTargets = [0, 0, 0, 0, 0, 0, 0];

	let currentPage;

	function updatePagination() {
		const list = document.querySelector('.partial-community-proj-comp-star-list');
		const totalPages = Number(Bem.data(list, 'total-pages'));
		currentPage = Number(Bem.data(list, 'current-page'));

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
					navigate(pageButtonTargets[index]);
				}
			});
		});
	}

	async function navigate(page) {
		const searchParams = new URLSearchParams({ page }).toString();
		const resp = await fetch(`/community/${pageType}/${link}/stargazers/page?${searchParams}`);
		pageContainer.innerHTML = await resp.text();

		const baseUrl = [location.protocol, '//', location.host, location.pathname].join('');
		window.history.pushState({}, '', baseUrl + '?' + searchParams);
		updatePagination();
	}

	updatePagination();
	addPageButtonListeners();
}
communityProjCompStar();
