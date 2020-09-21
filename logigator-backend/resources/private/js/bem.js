const Bem = {

    /**
     * @param {Element} node
     * @returns {string}
     */
    bemClass(node) {
        if (node.classList.length === 1) {
            return node.classList[0];
        } else {
            for (let i = 0; i < node.classList.length; i++) {
                if (!node.classList[i].includes('--')) {
                    return node.classList[i];
                }
            }
            return undefined;
        }
    },

    /**
     * @param {Element} node
     * @param {string} element
     * @returns {Element}
     */
    element(node, element) {
        const bemClass = Bem.bemClass(node);
        return node.querySelector(`.${bemClass}__${element}`);
    },

	/**
	 * @param {Element} node
	 * @param {string} element
	 * @returns {NodeList<HTMLElement>}
	 */
	elements(node, element) {
		const bemClass = Bem.bemClass(node);
		return node.querySelectorAll(`.${bemClass}__${element}`);
	},

    /**
     * @param {Element} node
     * @param {string} state
     * @param {boolean} active
     */
    setState(node, state, active) {
        if (active) {
            node.classList.add(`is-${state}`);
        } else {
            node.classList.remove(`is-${state}`);
        }
    },

    /**
     * @param {Element} node
     * @param {string} state
     * @returns {boolean}
     */
    hasState(node, state) {
        return node.classList.contains(`is-${state}`);
    },

    /**
     * @param {Element} node
     * @param {string} state
     */
    toggleState(node, state) {
        node.classList.toggle(`is-${state}`);
    },

    /**
     * @param {Element} node
     * @param {string} modifier
     * @returns {boolean}
     */
    hasModifier(node, modifier) {
        const bemClass = Bem.bemClass(node);
        return node.classList.contains(`${bemClass}--${modifier}`);
    },

    /**
     * @param {Element} node
     * @param {string} data
     * @returns {string}
     */
    data(node, data) {
        return node.getAttribute(`data-${data}`);
    },

    /**
     * @param {Element} node
     * @param {string} data
     * @returns {boolean}
     */
    hasData(node, data) {
        return node.hasAttribute(`data-${data}`);
    }
};
