document.addEventListener('DOMContentLoaded', () => {
    console.log('AnimeVerse Client Loaded');

    // 1. Search Logic
    const searchInput = document.querySelector('.search-bar input');
    if (searchInput) {
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (query) {
                    window.location.href = `/search?q=${encodeURIComponent(query)}`;
                }
            }
        });
    }

    // 2. Mobile Menu (Future Expansion)
    // You can add logic here to toggle .nav-links on mobile
});