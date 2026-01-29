export const findItemIndexByCode = (items, code) => {
	if (!Array.isArray(items) || !code) {
		return -1;
	}
	return items.findIndex((item) => item && item.item_code === code);
};

export const getNextHighlightedIndex = ({ currentIndex, itemsLength, direction }) => {
	if (!itemsLength || itemsLength <= 0) {
		return -1;
	}

	if (currentIndex < 0) {
		return direction > 0 ? 0 : itemsLength - 1;
	}

	let nextIndex = currentIndex + direction;
	if (nextIndex < 0) {
		nextIndex = 0;
	}
	if (nextIndex >= itemsLength) {
		nextIndex = itemsLength - 1;
	}
	return nextIndex;
};
