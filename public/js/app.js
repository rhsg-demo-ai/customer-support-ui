
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the application
    initializeFormHandlers();
    initializeTooltips();
});

function initializeFormHandlers() {
    const messageSelect = document.getElementById('messageSelect');
    const contentPreview = document.getElementById('contentPreview');
    const submitBtn = document.getElementById('submitBtn');
    
    if (messageSelect && contentPreview && submitBtn) {
        // Handle message selection change
        messageSelect.addEventListener('change', function() {
            updatePreview();
        });
        
        // Handle form submission
        const form = document.querySelector('form');
        if (form) {
            form.addEventListener('submit', function(e) {
                if (!messageSelect.value) {
                    e.preventDefault();
                    alert('Please select a message before submitting.');
                    return false;
                }
                
                // Show loading state
                submitBtn.disabled = true;
                submitBtn.textContent = 'Submitting to Kafka...';
                
                // Add loading animation
                submitBtn.style.position = 'relative';
                submitBtn.innerHTML = 'Submitting to Kafka... <span class="loading-spinner">⏳</span>';
            });
        }
    }
}

function updatePreview() {
    const select = document.getElementById('messageSelect');
    const preview = document.getElementById('contentPreview');
    const submitBtn = document.getElementById('submitBtn');
    
    if (!select || !preview || !submitBtn) return;
    
    const selectedValue = select.value;
    
    if (selectedValue && window.intakeFiles && window.intakeFiles[selectedValue]) {
        const fileData = window.intakeFiles[selectedValue];
        preview.value = fileData.content;
        submitBtn.disabled = false;
        
        // Add some visual feedback
        preview.style.backgroundColor = '#fff';
        preview.style.border = '2px solid #5cb85c';
        
        // Reset border after a short delay
        setTimeout(() => {
            preview.style.border = '2px solid #e1e1e1';
        }, 1000);
        
    } else {
        preview.value = '';
        submitBtn.disabled = true;
        preview.style.backgroundColor = '#f8f9fa';
        preview.style.border = '2px solid #e1e1e1';
    }
}

function initializeTooltips() {
    // Add hover effects for better UX
    const buttons = document.querySelectorAll('.btn-primary, .btn-secondary');
    
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            if (!this.disabled) {
                this.style.transform = 'translateY(-2px)';
                this.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
            }
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none';
        });
    });
}

// Utility function to show notification messages
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 2rem;
        border-radius: 6px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
    `;
    
    // Set background color based on type
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#5cb85c';
            break;
        case 'error':
            notification.style.backgroundColor = '#d9534f';
            break;
        case 'warning':
            notification.style.backgroundColor = '#f0ad4e';
            break;
        default:
            notification.style.backgroundColor = '#5bc0de';
    }
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after delay
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 4000);
}

// Export functions for use in templates
window.updatePreview = updatePreview;
window.showNotification = showNotification;
