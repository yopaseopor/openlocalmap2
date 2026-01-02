// Router system for independent pages
class Router {
    constructor() {
        this.currentPage = null;
        this.pageHistory = [];
        this.init();
    }

    init() {
        // Handle initial load
        this.handleHashChange();

        // Listen for hash changes (browser back/forward)
        window.addEventListener('hashchange', () => {
            this.handleHashChange();
        });

        // Handle sidebar tab clicks
        this.setupSidebarNavigation();

        // Handle initial sidebar state
        this.initializeSidebar();
    }

    setupSidebarNavigation() {
        // Get all sidebar tabs
        const sidebarTabs = document.querySelectorAll('.sidebar-tabs a');

        sidebarTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const href = tab.getAttribute('href');
                if (href && href.startsWith('#')) {
                    this.navigateToPage(href.substring(1));
                }
            });
        });
    }

    initializeSidebar() {
        // Check if there's a page in the URL hash
        const hash = window.location.hash;
        if (hash && hash.length > 1) {
            const page = hash.substring(1);
            // Check if it's a valid page
            if (this.isValidPage(page)) {
                this.navigateToPage(page, false); // Don't update history on initial load
            } else {
                // Default to home page if invalid
                this.navigateToPage('home', false);
            }
        } else {
            // Default to home page
            this.navigateToPage('home', false);
        }
    }

    navigateToPage(pageId, updateHistory = true) {
        if (!this.isValidPage(pageId)) {
            console.warn('Invalid page:', pageId);
            return;
        }

        // Store previous page in history
        if (updateHistory && this.currentPage && this.currentPage !== pageId) {
            this.pageHistory.push(this.currentPage);
        }

        // Update current page
        this.currentPage = pageId;

        // Update URL hash without triggering hashchange
        const newHash = '#' + pageId;
        if (window.location.hash !== newHash) {
            // Use replaceState to avoid triggering hashchange
            const url = window.location.pathname + window.location.search + newHash;
            window.history.replaceState(null, null, url);
        }

        // Show the appropriate sidebar pane
        this.showPage(pageId);

        // Update sidebar tab active state
        this.updateTabActiveState(pageId);
    }

    showPage(pageId) {
        // Hide all sidebar panes by removing active class
        const allPanes = document.querySelectorAll('.sidebar-pane');
        allPanes.forEach(pane => {
            pane.classList.remove('active');
        });

        // Show the requested pane by adding active class
        const targetPane = document.getElementById(pageId);
        if (targetPane) {
            targetPane.classList.add('active');

            // Trigger any page-specific initialization
            this.initializePage(pageId);
        }
    }

    updateTabActiveState(activePageId) {
        // Remove active class from all tabs
        const allTabs = document.querySelectorAll('.sidebar-tabs a');
        allTabs.forEach(tab => {
            tab.parentElement.classList.remove('active');
        });

        // Add active class to the current tab
        const activeTab = document.querySelector(`.sidebar-tabs a[href="#${activePageId}"]`);
        if (activeTab) {
            activeTab.parentElement.classList.add('active');
        }
    }

    handleHashChange() {
        const hash = window.location.hash;
        if (hash && hash.length > 1) {
            const page = hash.substring(1);
            if (this.isValidPage(page)) {
                this.navigateToPage(page, false); // Don't add to history on hash change
            }
        } else {
            // Default to home if no hash
            this.navigateToPage('home', false);
        }
    }

    isValidPage(pageId) {
        // List of valid page IDs
        const validPages = [
            'search', 'home', 'routes', 'gtfs', 'wikipedia',
            'comments', 'parking', 'bikes', 'mapillary',
            'links', 'developer', 'language', 'about'
        ];
        return validPages.includes(pageId);
    }

    initializePage(pageId) {
        // Page-specific initialization (no automatic queries except real-time and GBFS)
        switch(pageId) {
            case 'home':
                // Initialize POIs if not already done
                if (typeof show_pois_checkboxes === 'function') {
                    show_pois_checkboxes();
                }
                break;
            case 'search':
                // Focus search input if empty
                const searchInput = document.getElementById('addr');
                if (searchInput && !searchInput.value) {
                    setTimeout(() => searchInput.focus(), 100);
                }
                break;
            // No automatic route initialization - user must click buttons manually
            // Add other page-specific initializations as needed
        }
    }

    goBack() {
        if (this.pageHistory.length > 0) {
            const previousPage = this.pageHistory.pop();
            this.navigateToPage(previousPage, false);
        }
    }

    // Public method to get current page
    getCurrentPage() {
        return this.currentPage;
    }

    // Public method to check if we can go back
    canGoBack() {
        return this.pageHistory.length > 0;
    }
}

// Initialize router when DOM is ready
let router;
document.addEventListener('DOMContentLoaded', function() {
    router = new Router();
});

// Global function for backward compatibility
function navigateToPage(pageId) {
    if (router) {
        router.navigateToPage(pageId);
    }
}

// Function to handle browser back button for pages
window.addEventListener('popstate', function(event) {
    // This handles browser back/forward when not just changing map position
    if (router) {
        router.handleHashChange();
    }
});
