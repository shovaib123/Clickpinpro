// script.js

document.addEventListener("DOMContentLoaded", () => {
    // Functionality to display pins
    function displayPins(pins) {
        const pinContainer = document.getElementById('pinContainer');
        pinContainer.innerHTML = ''; // Clear previous pins
        pins.forEach(pin => {
            const pinElement = document.createElement('div');
            pinElement.className = 'pin';
            pinElement.innerText = pin.title; // Assuming each pin has a title
            pinContainer.appendChild(pinElement);
        });
    }

    // Functionality for downloading content
    function downloadContent(content) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
        link.download = 'download.txt'; // Default download file name
        link.click();
    }

    // Explore capability
    function exploreContent() {
        // Logic for exploring content
        // This could involve searching/filtering pins or other data
        console.log("Exploring content...");
    }

    // Event listeners for interactivity
    document.getElementById('downloadButton').addEventListener('click', () => {
        downloadContent("Sample content to download");
    });

    document.getElementById('exploreButton').addEventListener('click', exploreContent);

    // Sample pins data
    const pins = [
        { title: "Pin 1" },
        { title: "Pin 2" },
        { title: "Pin 3" }
    ];

    // Displaying pins on load
    displayPins(pins);
});