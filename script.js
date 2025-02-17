let port;
let reader;
let writer;
let keepReading = true;
let buffer = ''; // Buffer to accumulate partial data
const CRITICAL_TEMP = 120; // Critical temperature threshold in Celsius

// Add these variables for ESP status tracking
let lastParentEspData = new Date();  // Tracks last data received from parent ESP32
let childEspLastSeen = [
  new Date(),  // Child ESP32 #1
  new Date(),  // Child ESP32 #2
  new Date()   // Child ESP32 #3
];
const CONNECTION_TIMEOUT = 5000;      // 5 seconds timeout to consider device offline
let statusCheckInterval;             // Interval for checking connection status

// Utility function for calculating time ago
function getTimeAgo(timestamp) {
    const now = new Date();
    const diffInMinutes = Math.floor((now - timestamp) / 1000 / 60);
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
}

// Function to update ESP status indicators
// function updateESPStatus() {
//     const now = new Date();
    
//     // Update Parent ESP32 status
//     const parentElement = document.getElementById('esp-parent');
//     if (parentElement) {
//         const statusIcon = parentElement.querySelector('.status-icon');
//         const statusBadge = parentElement.querySelector('.status-badge');
//         const lastSeen = parentElement.querySelector('.last-seen');
        
//         if (now - lastParentEspData < CONNECTION_TIMEOUT) {
//             // Parent ESP32 is online
//             statusIcon?.classList.add('online');
//             statusBadge.textContent = 'Online';
//             statusBadge?.classList.add('online');
//             const timeAgo = getTimeAgo(lastParentEspData);
//             lastSeen.textContent = `Last seen: ${timeAgo}`;
//         } else {
//             // Parent ESP32 is offline
//             statusIcon?.classList.remove('online');
//             statusBadge.textContent = 'Offline';
//             statusBadge?.classList.remove('online');
//             lastSeen.textContent = 'Last seen: Disconnected';
//         }
//     }
    
//     // Update Child ESP32 statuses
//     for (let i = 1; i <= 3; i++) {
//         const childElement = document.getElementById(`esp-child-${i}`);
//         if (childElement) {
//             const statusIcon = childElement.querySelector('.status-icon');
//             const statusBadge = childElement.querySelector('.status-badge');
//             const lastSeen = childElement.querySelector('.last-seen');
            
//             if (now - childEspLastSeen[i-1] < CONNECTION_TIMEOUT) {
//                 // Child ESP32 is online
//                 statusIcon?.classList.add('online');
//                 statusBadge.textContent = 'Online';
//                 statusBadge?.classList.add('online');
//                 const timeAgo = getTimeAgo(childEspLastSeen[i-1]);
//                 lastSeen.textContent = `Last seen: ${timeAgo}`;
//             } else {
//                 // Child ESP32 is offline
//                 statusIcon?.classList.remove('online');
//                 statusBadge.textContent = 'Offline';
//                 statusBadge?.classList.remove('online');
//                 lastSeen.textContent = 'Last seen: Disconnected';
//             }
//         }
//     }
// }

// Modified updateESPStatus function
function updateESPStatus() {
    const now = new Date();
    
    // Update Parent ESP32 status
    const parentElement = document.getElementById('esp-parent');
    if (parentElement) {
        const statusIcon = parentElement.querySelector('.status-icon');
        const statusBadge = parentElement.querySelector('.status-badge');
        const lastSeen = parentElement.querySelector('.last-seen');
        
        if (now - lastParentEspData < CONNECTION_TIMEOUT) {
            // Parent ESP32 is online
            statusIcon?.classList.add('online');
            statusBadge.textContent = 'Online';
            statusBadge?.classList.add('online');
            parentElement.classList.add('online');     // Add class to full box
            parentElement.classList.remove('offline'); // Remove offline class
            const timeAgo = getTimeAgo(lastParentEspData);
            lastSeen.textContent = `Last seen: ${timeAgo}`;
        } else {
            // Parent ESP32 is offline
            statusIcon?.classList.remove('online');
            statusBadge.textContent = 'Offline';
            statusBadge?.classList.remove('online');
            parentElement.classList.remove('online');  // Remove online class
            parentElement.classList.add('offline');    // Add class to full box
            lastSeen.textContent = 'Last seen: Disconnected';
        }
    }
    
    // Update Child ESP32 statuses
    for (let i = 1; i <= 3; i++) {
        const childElement = document.getElementById(`esp-child-${i}`);
        if (childElement) {
            const statusIcon = childElement.querySelector('.status-icon');
            const statusBadge = childElement.querySelector('.status-badge');
            const lastSeen = childElement.querySelector('.last-seen');
            
            if (now - childEspLastSeen[i-1] < CONNECTION_TIMEOUT) {
                // Child ESP32 is online
                statusIcon?.classList.add('online');
                statusBadge.textContent = 'Online';
                statusBadge?.classList.add('online');
                childElement.classList.add('online');     // Add class to full box
                childElement.classList.remove('offline'); // Remove offline class
                const timeAgo = getTimeAgo(childEspLastSeen[i-1]);
                lastSeen.textContent = `Last seen: ${timeAgo}`;
            } else {
                // Child ESP32 is offline
                statusIcon?.classList.remove('online');
                statusBadge.textContent = 'Offline';
                statusBadge?.classList.remove('online');
                childElement.classList.remove('online');  // Remove online class
                childElement.classList.add('offline');    // Add class to full box
                lastSeen.textContent = 'Last seen: Disconnected';
            }
        }
    }
}

// Safety functions
function showTemperatureAlert(temp) {
    alert(`WARNING: LIM Temperature Critical (${temp}°C)\nEmergency Brakes Engaged!`);
}

async function activateEmergencyBrakes() {
    if (writer) {
        try {
            await writer.write("EMERGENCY_BRAKE\n");
            console.log("Emergency brakes activated due to critical temperature");
            
            // Get pod stop button and handle everything related to it
            const podStop = document.getElementById('podStop');
            if (podStop) {
                // Change button color to red
                podStop.style.backgroundColor = '#ff0000';
                
                // Trigger the stop if not already stopped
                if (!podStop.classList.contains('active')) {
                    console.log('Automatically triggering pod stop due to critical temperature');
                    podStop.click(); // This will trigger the existing click event handler
                } else {
                    console.log('Pod already stopped');
                }
            } else {
                console.error('Pod stop button not found');
            }

        } catch (error) {
            console.error("Failed to activate emergency brakes:", error);
        }
    }
}

function calculateSpeed(acceleration) {
    return Math.abs(acceleration); // Simple conversion of acceleration to speed
}

async function handleData(data) {
    try {
        console.log('Parsed data:', data);

        // Update parent ESP timestamp
        lastParentEspData = new Date();
        
        // Handle device status updates
        if (data.device !== undefined && data.status !== undefined) {
            const deviceId = data.device;
            if (deviceId >= 1 && deviceId <= 3) {
                // Update the corresponding child ESP timestamp
                childEspLastSeen[deviceId-1] = new Date();
                console.log(`Updated Child ESP ${deviceId} last seen timestamp`);
            }

            // This is a device status message
            const isOnline = data.status === "online";
            const batteryLevel = data.battery;
            
            // Update the appropriate ESP status display
            const statusDisplay = document.getElementById(`esp-status-${deviceId}`);
            if (statusDisplay) {
                statusDisplay.textContent = isOnline ? "Online" : "Offline";
                statusDisplay.classList.remove(isOnline ? 'offline' : 'online');
                statusDisplay.classList.add(isOnline ? 'online' : 'offline');
            }
            
            // Log the status update
            console.log(`ESP ${deviceId} is ${isOnline ? 'online' : 'offline'} with battery ${batteryLevel}`);
        }

        // Handle MLX90614 and DS18B20 temperatures
        if (data.mlxTemperature !== undefined || data.dsTemperature !== undefined) {
            const mlxTemp = data.mlxTemperature;
            const dsTemp = data.dsTemperature;
            
            // Update MLX90614 temperature display
            const mlxTempDisplay = document.getElementById('battery-temp-lv');
            if (mlxTempDisplay && mlxTemp !== undefined) {
                mlxTempDisplay.textContent = `${mlxTemp.toFixed(1)}°C`;
                console.log('MLX temperature display updated:', mlxTemp);
            }
            
            // Update DS18B20 temperature display
            const dsTempDisplay = document.getElementById('motor-temp');
            if (dsTempDisplay && dsTemp !== undefined) {
                dsTempDisplay.textContent = `${dsTemp.toFixed(1)}°C`;
                console.log('DS temperature display updated:', dsTemp);
            }

            // Check for critical temperature from either sensor
            if (mlxTemp > CRITICAL_TEMP || dsTemp > CRITICAL_TEMP) {
                const criticalTemp = Math.max(mlxTemp || 0, dsTemp || 0);
                showTemperatureAlert(criticalTemp);
                await activateEmergencyBrakes();
            }
        }

        // Handle additional temperature sensors (object and ambient)
        if (data.objectTemp !== undefined || data.ambientTemp !== undefined) {
            const objTemp = data.objectTemp;
            const ambTemp = data.ambientTemp;
            
            // Update object temperature display
            const objTempDisplay = document.getElementById('object-temp');
            if (objTempDisplay && objTemp !== undefined) {
                objTempDisplay.textContent = `${objTemp.toFixed(1)}°C`;
                console.log('Object temperature display updated:', objTemp);
            }
            
            // Update ambient temperature display
            const ambTempDisplay = document.getElementById('ambient-temp');
            if (ambTempDisplay && ambTemp !== undefined) {
                ambTempDisplay.textContent = `${ambTemp.toFixed(1)}°C`;
                console.log('Ambient temperature display updated:', ambTemp);
            }

            // Check for critical temperature
            if (objTemp > CRITICAL_TEMP) {
                showTemperatureAlert(objTemp);
                await activateEmergencyBrakes();
            }
        }

        // Handle IMU acceleration
        if (data.accel && Array.isArray(data.accel)) {
            const maxAccel = Math.max(...data.accel.map(Math.abs));
            const speed = calculateSpeed(maxAccel);
            const speedElement = document.getElementById('speed-value');
            if (speedElement) {
                speedElement.textContent = `${speed.toFixed(2)} m/s`;
                console.log('Speed display updated');
            } else {
                console.error('Speed display element not found');
            }
        }

        // Handle voltage readings
        if (data.VB1 !== undefined && data.VB2 !== undefined && data.VB3 !== undefined) {
            const inverterVoltage = document.getElementById('Inverter-voltage');
            const lvsVoltage = document.getElementById('LVS-voltage');
            const contacterVoltage = document.getElementById('Contacter-voltage');
            if (inverterVoltage) {
                inverterVoltage.textContent = `${data.VB1}V`;
            }
            if (lvsVoltage) {
                lvsVoltage.textContent = `${data.VB2}V`;
            }
            if (contacterVoltage) {
                contacterVoltage.textContent = `${data.VB3}V`;
            }
        }
    } catch (error) {
        console.error('Error processing data:', error);
    }
}

async function controlRelay(relay, state) {
    if (writer) {
        try {
            // Just send single character command
            if (state === 'ON') {
                await writer.write(`${relay}\n`); // Capital letter for ON
            } else {
                await writer.write(`${relay.toLowerCase()}\n`); // Lowercase for OFF
            }
        } catch (error) {
            console.error(`Failed to control relay ${relay}:`, error);
        }
    }
}

document.addEventListener('DOMContentLoaded', (event) => {
    console.log('Document loaded');
    const connectButton = document.getElementById('connectESP32');
    const podStartButton = document.getElementById('brakeRelease');
    const lvStartButton = document.getElementById('LVEngage');
    const launchpadStartButton = document.getElementById('launchpadStart');
    const inverterStartButton = document.getElementById('InverterStart');
    const contactor = document.getElementById('contactor');
    const podStop = document.getElementById('podStop');

    // Start the status update interval
    statusCheckInterval = setInterval(updateESPStatus, 1000);

    if (connectButton) {
        console.log('Connect button found');
        connectButton.addEventListener('click', async () => {
            console.log('Connect button clicked');
            try {
                // Request and open serial port
                port = await navigator.serial.requestPort();
                await port.open({ baudRate: 115200 });
                console.log('Serial port opened successfully');

                // Setup streams
                const textDecoder = new TextDecoderStream();
                port.readable.pipeTo(textDecoder.writable);
                reader = textDecoder.readable.getReader();

                const textEncoder = new TextEncoderStream();
                textEncoder.readable.pipeTo(port.writable);
                writer = textEncoder.writable.getWriter();
                
                // Update connection button
                connectButton.classList.add('connected');
                console.log('Connected to ESP32');

                // Continuously read data
                while (keepReading) {
                    const { value, done } = await reader.read();
                    if (done) {
                        console.log('Reader done');
                        reader.releaseLock();
                        break;
                    }

                    buffer += value; // Append incoming data to the buffer
                    console.log('Accumulated buffer:', buffer);

                    // Check if the buffer contains a complete JSON string
                    let endOfJson = buffer.indexOf('}') + 1;
                    if (endOfJson > 0) {
                        const jsonString = buffer.substring(0, endOfJson); // Extract the complete JSON string
                        buffer = buffer.substring(endOfJson); // Keep the remaining data in the buffer

                        try {
                            // Parse the complete JSON string
                            const data = JSON.parse(jsonString);
                            await handleData(data);
                        } catch (error) {
                            console.error('Error parsing data:', error);
                            console.log('Unparsed data:', jsonString);
                        }
                    }
                }
            } catch (error) {
                console.error('Connection error:', error);

                // Update connection button
                connectButton.classList.remove('connected');

                // Update status (example: parent ESP is "esp-status-1")
                const statusDisplay = document.getElementById('esp-status-1');
                if (statusDisplay) {
                    statusDisplay.textContent = "Error";
                    statusDisplay.classList.remove('online');
                    statusDisplay.classList.add('offline');
                }
            }
        });
    } else {
        console.error('Connect button not found');
    }

    // POD START button toggle functionality
    if (podStartButton) {
        console.log('POD START button found');
        // podStartButton.addEventListener('click', async () => {
        //     console.log('POD START button clicked');
        //     // if (podStartButton.classList.contains('active')) {
        //     //     podStartButton.classList.remove('active');
        //     //     podStartButton.style.backgroundColor = 'green';
        //     //     podStartButton.textContent = 'POD START';
        //     //     await controlRelay('a', 'OFF'); // Relay A OFF
        //     // } else {
        //     //     podStartButton.classList.add('active');
        //     //     podStartButton.style.backgroundColor = 'red';
        //     //     podStartButton.textContent = 'POD STOP';
        //     //     await controlRelay('A', 'ON'); // Relay A ON
        //     // }
        //     // POD START button
        //     if (podStartButton.classList.contains('active')) {
        //         podStartButton.classList.remove('active');
        //         podStartButton.style.backgroundColor = 'green';
        //         podStartButton.textContent = 'POD START';
        //         await controlRelay('a'); // Just send 'a' for OFF
        //     } else {
        //         podStartButton.classList.add('active');
        //         podStartButton.style.backgroundColor = 'red';
        //         podStartButton.textContent = 'POD STOP';
        //         await controlRelay('A'); // Just send 'A' for ON
        //     }
        // });
        podStartButton.addEventListener('click', async () => {
            if (podStartButton.classList.contains('active')) {
                podStartButton.classList.remove('active');
                podStartButton.style.backgroundColor = 'green';
                podStartButton.textContent = 'POD START';
                await controlRelay('a', 'OFF'); // Now just sends 'a'
            } else {
                podStartButton.classList.add('active');
                podStartButton.style.backgroundColor = 'red';
                podStartButton.textContent = 'POD STOP';
                await controlRelay('A', 'ON'); // Now just sends 'A'
            }
        });
    } else {
        console.error('POD START button not found');
    }
    
    // POD STOP button toggle functionality
    if (podStop) {
        console.log('POD STOP button found');
        podStop.addEventListener('click', async () => {
            console.log('POD STOP button clicked');
            if (podStop.classList.contains('active')) {
                podStop.classList.remove('active');
                podStop.style.backgroundColor = '#FFA500';
                if (contactor.classList.contains('active')) {
                    contactor.classList.remove('active');
                    contactor.style.backgroundColor = 'green';
                } else {
                    contactor.classList.add('active');
                    contactor.style.backgroundColor = 'red';
                }
                if (podStartButton.classList.contains('active')) {
                    podStartButton.classList.remove('active');
                    podStartButton.style.backgroundColor = 'green';
                    podStartButton.textContent = 'POD START';
                } else {
                    podStartButton.classList.add('active');
                    podStartButton.style.backgroundColor = 'red';
                    podStartButton.textContent = 'POD STOP';
                }
                // await controlRelay('b','OFF'); // Relay d OFF
                // await controlRelay('a','OFF'); // Relay c OFF
                await controlRelay('B', 'ON'); // Relay D ON
                await controlRelay('A', 'ON'); // Relay C ON
            } else {
                if (contactor.classList.contains('active')) {
                    contactor.classList.remove('active');
                    contactor.style.backgroundColor = 'green';
                } else {
                    contactor.classList.add('active');
                    contactor.style.backgroundColor = 'red';
                }
                if (podStartButton.classList.contains('active')) {
                    podStartButton.classList.remove('active');
                    podStartButton.style.backgroundColor = 'green';
                    podStartButton.textContent = 'POD START';
                } else {
                    podStartButton.classList.add('active');
                    podStartButton.style.backgroundColor = 'red';
                    podStartButton.textContent = 'POD STOP';
                }
                podStop.classList.add('active');
                podStop.style.backgroundColor = '#FF4500';
                await controlRelay('b','OFF'); // Relay d OFF
                await controlRelay('a','OFF'); // Relay c OFF
            }
        });
    } else {
        console.error('POD Stop button not found');
    }
    
    // CONTACTOR button toggle functionality
    if (contactor) {
        console.log('contactor button found');
        contactor.addEventListener('click', async () => {
            console.log('contactor button clicked');
            if (contactor.classList.contains('active')) {
                contactor.classList.remove('active');
                contactor.style.backgroundColor = 'green';
                await controlRelay('b', 'OFF'); // Relay d OFF
            } else {
                contactor.classList.add('active');
                contactor.style.backgroundColor = 'red';
                await controlRelay('B', 'ON'); // Relay D ON
            }
        });
    } else {
        console.error('contactor button not found');
    }

    // LV START button toggle functionality
    if (lvStartButton) {
        console.log('LV START button found');
        lvStartButton.addEventListener('click', async () => {
            console.log('LV START button clicked');
            if (lvStartButton.classList.contains('active')) {
                lvStartButton.classList.remove('active');
                lvStartButton.style.backgroundColor = 'green';
                lvStartButton.textContent = 'LV START';
                await controlRelay('b', 'OFF'); // Relay B OFF
            } else {
                lvStartButton.classList.add('active');
                lvStartButton.style.backgroundColor = 'red';
                lvStartButton.textContent = 'LV STOP';
                await controlRelay('B', 'ON'); // Relay B ON
            }
        });
    } else {
        console.error('LV START button not found');
    }

    // Launchpad START button toggle functionality
    if (launchpadStartButton) {
        console.log('Launchpad START button found');
        launchpadStartButton.addEventListener('click', async () => {
            console.log('Launchpad START button clicked');
            if (launchpadStartButton.classList.contains('active')) {
                launchpadStartButton.classList.remove('active');
                launchpadStartButton.style.backgroundColor = 'green';
                launchpadStartButton.textContent = 'Launchpad START';
                await controlRelay('c', 'OFF'); // Relay C OFF
            } else {
                launchpadStartButton.classList.add('active');
                launchpadStartButton.style.backgroundColor = 'red';
                launchpadStartButton.textContent = 'Launchpad STOP';
                await controlRelay('C', 'ON'); // Relay C ON
            }
        });
    } else {
        console.error('Launchpad START button not found');
    }

    // Inverter START button toggle functionality
    if (inverterStartButton) {
        console.log('Inverter START button found');
        inverterStartButton.addEventListener('click', async () => {
            console.log('Inverter START button clicked');
            if (inverterStartButton.classList.contains('active')) {
                inverterStartButton.classList.remove('active');
                inverterStartButton.style.backgroundColor = 'green';
                inverterStartButton.textContent = 'Inverter START';
                await controlRelay('d', 'OFF'); // Relay D OFF
            } else {
                inverterStartButton.classList.add('active');
                inverterStartButton.style.backgroundColor = 'red';
                inverterStartButton.textContent = 'Inverter STOP';
                await controlRelay('D', 'ON'); // Relay D ON
            }
        });
    } else {
        console.error('Inverter START button not found');
    }

    // Emergency brake control
    const emergencyBrakeButton = document.getElementById('emergencyBrake');
    if (emergencyBrakeButton) {
        emergencyBrakeButton.addEventListener('click', async () => {
            console.log('EMERGENCY STOP button clicked');
            await activateEmergencyBrakes();
        });
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    keepReading = false;
    if (reader) reader.cancel();
    if (writer) writer.releaseLock();
    if (port) port.close();
    if (statusCheckInterval) clearInterval(statusCheckInterval);
});
