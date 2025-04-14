// Messaging functionality
let selectedReceiverId = null;
let messages = [];
let lastMessageId = 0;

document.addEventListener('DOMContentLoaded', function() {
  // Check if we're on the messaging page
  const chatContainer = document.getElementById('chat-container');
  if (!chatContainer) return;
  
  // Load contact list
  loadContactList();
  
  // Setup message form
  setupMessageForm();
  
  // Connect WebSocket
  connectWebSocket();
  
  // Setup SOS button if child view
  setupSosButton();
});

// Load contact list (parents or children depending on user role)
function loadContactList() {
  const contactList = document.getElementById('contact-list');
  if (!contactList) return;
  
  if (currentUser.role === 'parent') {
    // Load children
    fetch('/api/children')
      .then(response => response.json())
      .then(children => {
        displayContacts(children);
      })
      .catch(error => console.error('Error loading children:', error));
  } else {
    // Load parent
    fetch('/api/parent')
      .then(response => response.json())
      .then(parent => {
        displayContacts([parent]);
      })
      .catch(error => console.error('Error loading parent:', error));
  }
}

// Display contacts in the list
function displayContacts(contacts) {
  const contactList = document.getElementById('contact-list');
  if (!contactList) return;
  
  // Clear existing list
  contactList.innerHTML = '';
  
  contacts.forEach(contact => {
    const listItem = document.createElement('li');
    listItem.className = 'contact-item';
    listItem.setAttribute('data-user-id', contact.id);
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'contact-name';
    nameSpan.textContent = contact.username;
    
    listItem.appendChild(nameSpan);
    contactList.appendChild(listItem);
    
    // Add click event to select this contact
    listItem.addEventListener('click', function() {
      // Remove active class from all contacts
      document.querySelectorAll('.contact-item').forEach(item => {
        item.classList.remove('active');
      });
      
      // Add active class to selected contact
      listItem.classList.add('active');
      
      // Load conversation with this contact
      selectedReceiverId = contact.id;
      loadConversation(selectedReceiverId);
      
      // Show chat input
      const chatInput = document.getElementById('chat-input-container');
      if (chatInput) {
        chatInput.style.display = 'flex';
      }
    });
  });
  
  // If there's only one contact, select it automatically
  if (contacts.length === 1) {
    const contactItem = contactList.querySelector('.contact-item');
    contactItem.click();
  }
}

// Load conversation with selected contact
function loadConversation(receiverId) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  // Set data attribute for identifying active chat
  chatMessages.setAttribute('data-user-id', receiverId);
  
  fetch(`/api/message/conversation/${receiverId}`)
    .then(response => response.json())
    .then(data => {
      messages = data.reverse(); // Reverse to show newest at bottom
      displayMessages(messages);
      
      // Update latest message ID
      if (messages.length > 0) {
        lastMessageId = Math.max(...messages.map(m => m.id));
      }
    })
    .catch(error => console.error('Error loading conversation:', error));
}

// Display messages in the chat window
function displayMessages(messages) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  // Clear existing messages
  chatMessages.innerHTML = '';
  
  if (messages.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-chat';
    emptyMessage.textContent = 'No messages yet. Start the conversation!';
    chatMessages.appendChild(emptyMessage);
    return;
  }
  
  messages.forEach(message => {
    addMessageToChat(message, true);
  });
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add a single message to the chat
function addMessageToChat(message, isFromHistory = false) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  
  const messageDiv = document.createElement('div');
  
  // Determine if message is sent or received
  const isSent = !isFromHistory ? true : message.sender_id == currentUser.id;
  messageDiv.className = `message ${isSent ? 'message-sent' : 'message-received'}`;
  
  // Message content
  messageDiv.textContent = message.content;
  
  // Message time
  const timeSpan = document.createElement('span');
  timeSpan.className = 'message-time';
  
  const messageTime = isFromHistory ? 
    new Date(message.timestamp) : 
    message.timestamp ? new Date(message.timestamp) : new Date();
  
  timeSpan.textContent = messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  messageDiv.appendChild(timeSpan);
  
  // Add to chat
  chatMessages.appendChild(messageDiv);
  
  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Setup message form
function setupMessageForm() {
  const messageForm = document.getElementById('message-form');
  if (!messageForm) return;
  
  messageForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();
    
    if (!message || !selectedReceiverId) return;
    
    // Send message
    sendMessage(selectedReceiverId, message);
    
    // Clear input
    messageInput.value = '';
  });
}

// Send message to server
function sendMessage(receiverId, content) {
  fetch('/api/message/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      receiver_id: receiverId,
      content: content
    }),
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Add message to chat
      const messageData = {
        sender_id: currentUser.id,
        receiver_id: receiverId,
        content: content,
        timestamp: new Date(),
        id: data.message_id,
        is_read: false
      };
      
      // Add to local messages array
      messages.push(messageData);
      
      // Display in chat window
      addMessageToChat(messageData, true);
      
      // Notify via WebSocket
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'message_sent',
          data: {
            sender_id: currentUser.id,
            receiver_id: receiverId,
            content: content,
            message_id: data.message_id
          }
        }));
      }
    } else {
      showAlert('Error sending message', 'danger');
    }
  })
  .catch(error => {
    console.error('Error sending message:', error);
    showAlert('Error sending message', 'danger');
  });
}

// Poll for new messages periodically as a fallback if WebSocket fails
function pollForNewMessages() {
  if (!selectedReceiverId) return;
  
  fetch(`/api/message/conversation/${selectedReceiverId}`)
    .then(response => response.json())
    .then(data => {
      // Check for new messages
      if (data.length > 0) {
        const newLastMessageId = Math.max(...data.map(m => m.id));
        
        if (newLastMessageId > lastMessageId) {
          // Filter to only show new messages
          const newMessages = data.filter(m => m.id > lastMessageId);
          
          // Add new messages to the chat
          newMessages.reverse().forEach(message => {
            // Only add if not already in the messages array
            if (!messages.some(m => m.id === message.id)) {
              messages.push(message);
              addMessageToChat(message, true);
            }
          });
          
          lastMessageId = newLastMessageId;
        }
      }
    })
    .catch(error => console.error('Error polling messages:', error));
}

// Setup SOS button
function setupSosButton() {
  const sosButton = document.getElementById('sos-button');
  if (!sosButton) return;
  
  sosButton.addEventListener('click', function() {
    if (confirm('Are you sure you want to send an emergency SOS alert?')) {
      sendSosAlert();
    }
  });
}

// Send SOS alert
function sendSosAlert() {
  fetch('/api/sos', {
    method: 'POST'
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      showAlert('SOS alert sent successfully', 'success');
      
      // Send via WebSocket too
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'sos_alert',
          data: {
            child_id: currentUser.id
          }
        }));
      }
      
      // Show message in chat
      if (selectedReceiverId) {
        const messageData = {
          sender_id: currentUser.id,
          receiver_id: selectedReceiverId,
          content: "SOS EMERGENCY: I need help!",
          timestamp: new Date(),
          id: Date.now(), // Temporary ID
          is_read: false
        };
        
        addMessageToChat(messageData, true);
      }
    } else {
      showAlert('Error sending SOS alert', 'danger');
    }
  })
  .catch(error => {
    console.error('Error sending SOS alert:', error);
    showAlert('Error sending SOS alert', 'danger');
  });
}
