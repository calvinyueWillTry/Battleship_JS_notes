const express = require('express')
const path = require('path')
const http = require('http')
const PORT = process.env.PORT || 3000
const socketio = require('socket.io') //specific software required
const app = express()
const server = http.createServer(app)
const io = socketio(server)

// Set static folder
app.use(express.static(path.join(__dirname, "public")))

// Start server
server.listen(PORT, () => console.log(`Server running on port ${PORT}`))

// Handle a socket connection request from web client
const connections = [null, null]

io.on('connection', socket => {
  // console.log('New WS Connection')

  // Find an available player number
  let playerIndex = -1;
  for (const i in connections) {
    if (connections[i] === null) {
      playerIndex = i
      break
    }
  }

  // Tell the connecting client what player number they are
  socket.emit('player-number', playerIndex)

  console.log(`Player ${playerIndex} has connected`)

  // Ignore player 3
  if (playerIndex === -1) return

  connections[playerIndex] = false

  // Tell eveyone what player number just connected
  socket.broadcast.emit('player-connection', playerIndex)

  // Handle Diconnect
  socket.on('disconnect', () => {
    console.log(`Player ${playerIndex} disconnected`)
    connections[playerIndex] = null
    //Tell everyone what player numbe just disconnected
    socket.broadcast.emit('player-connection', playerIndex)
  })

  // On Ready
  socket.on('player-ready', () => {
    socket.broadcast.emit('enemy-ready', playerIndex)
    connections[playerIndex] = true
  })

  // Check player connections
  socket.on('check-players', () => {
    const players = []
    for (const i in connections) {
      connections[i] === null ? players.push({connected: false, ready: false}) : players.push({connected: true, ready: connections[i]})
    }
    socket.emit('check-players', players)
  })

  // On Fire Received
  socket.on('fire', id => {
    console.log(`Shot fired from ${playerIndex}`, id)

    // Emit the move to the other player
    socket.broadcast.emit('fire', id)
  })

  // on Fire Reply
  socket.on('fire-reply', square => {
    console.log(square)

    // Forward the reply to the other player
    socket.broadcast.emit('fire-reply', square)
  })

  // Timeout connection
  setTimeout(() => {
    connections[playerIndex] = null
    socket.emit('timeout')
    socket.disconnect()
  }, 600000) // 10 minute limit per player
})

document.addEventListener('DOMContentLoaded', () => {
    const userGrid = document.querySelector('.grid-user'); //the grid where the user's ships will be placed
    const computerGrid = document.querySelector('.grid-computer'); // grid where the computer's ships will be placed
    const displayGrid = document.querySelector('.grid-display'); //grid where the game display will be shown
    const ships = document.querySelectorAll('.ship') //all elements with the class name "ship" and stores them in the ships variable (ships that will be placed on the grids)
    const destroyer = document.querySelector('.destroyer-container');
    const submarine = document.querySelector('.submarine-container');
    const cruiser = document.querySelector('.cruiser-container');
    const battleship = document.querySelector('.battleship-container');
    const carrier = document.querySelector('.carrier-container');
    const startButton = document.querySelector('#start');
    const rotateButton = document.querySelector('#rotate');
    const turnDisplay = document.querySelector('#whose-go');
    const infoDisplay = document.querySelector('#info');
    const setupButtons = document.getElementById('setup-buttons');
    const userSquares = []; //initializes an empty array named userSquares
    const computerSquares = [];//initializes an empty array named computerSquares (opponents')
    let isHorizontal = true; //default value
    let isGameOver = false;
    let currentPlayer = 'user';
    const width = 10;//width of the board?
    let playerNum = 0; //0 is user, 1 is enemy? 
    let ready = false; //why set to false instead of default true? 
    let enemyReady = false;
    let allShipsPlaced = false;
    let shotFired = -1;
    //Ships
    const shipArray = [ //array that contains objects representing different ships in the game
      {//name: "string to represent the name of the ship"
        name: 'destroyer',
        directions: [ //the directions in which the ship can be placed on the game board.
          [0, 1],
          [0, width] 
        ] //numbers representing the positions of the ship
      },
      {
        name: 'submarine',
        directions: [
          [0, 1, 2],
          [0, width, width*2]
        ]
      },
      {
        name: 'cruiser',
        directions: [
          [0, 1, 2],
          [0, width, width*2]
        ]
      },
      {
        name: 'battleship',
        directions: [
          [0, 1, 2, 3],
          [0, width, width*2, width*3]
        ]
      },
      {
        name: 'carrier',
        directions: [
          [0, 1, 2, 3, 4],
          [0, width, width*2, width*3, width*4]
        ]
      },
    ]
  //two arguments: the grid element (userGrid) and possibly an array of user squares (userSquares)
    createBoard(userGrid, userSquares) //create a game board for the user, store references to these square elements
    createBoard(computerGrid, computerSquares) //populating with square elements, store references to these square elements
  
    // Select Player Mode
    if (gameMode === 'singlePlayer') {
      startSinglePlayer()
    } else {
      startMultiPlayer()
    }
  
    // Multiplayer
    function startMultiPlayer() { //to line 252
      const socket = io(); //implemented for real-time communication between players
  //establishes a connection to a socket.io server and listens for different events
      // Get your player number (id)
      socket.on('player-number', num => { 
        if (num === -1) { //If the received player number num is -1, it means that the server is full
          infoDisplay.innerHTML = "Sorry, the server is full"
        } else {
          playerNum = parseInt(num) //parsed to an integer and stored in the variable playerNum
          if(playerNum === 1) currentPlayer = "enemy"
  //If the playerNum is equal to 1, it sets the currentPlayer variable to "enemy"
          console.log(playerNum)
  //emits an event to the server to request information about other players' statuses from the server
          // Get other player status
          socket.emit('check-players')
        }
      })
  
      // Another player has connected or disconnected
      socket.on('player-connection', num => { //event is triggered when a player connects or disconnects.
        console.log(`Player number ${num} has connected or disconnected`) //ogs a message to the console indicating the player number that has connected or disconnected
        playerConnectedOrDisconnected(num) //on line 247
      })  
  
      // On enemy ready
      socket.on('enemy-ready', num => { //event is triggered when the opponent (enemy) is ready to play
        enemyReady = true 
        playerReady(num) //line 421
        if (ready) { //calls variable at line 113
          playGameMulti(socket) //line 402 (line 172 variable)
          setupButtons.style.display = 'none' 
        } //start the multiplayer game.hides the setup buttons by setting their display style to none.
      })
  
      // Check player status
      socket.on('check-players', players => {
        players.forEach((p, i) => { //For each (player p at index i (game id?)), it checks if the player is connected
          if(p.connected) playerConnectedOrDisconnected(i) //on line 247 (player p is connected)
          if(p.ready) { //player (boolean value status)
            playerReady(i) //line 421 (index i)
            if(i !== playerReady) enemyReady = true //
          } //seems to have a logical error as it compares the player index i with the playerReady variable 
        })//instead of checking if the player is not the current player. This might need to be corrected for the intended functionality.
      })
  
      // On Timeout
      socket.on('timeout', () => { //When the client receives a 'timeout' event from the server
        infoDisplay.innerHTML = 'You have reached the 10 minute limit'
      }) //updates the innerHTML of an element with the id infoDisplay to display the message
  
      // Ready button click
      startButton.addEventListener('click', () => {
        if(allShipsPlaced) playGameMulti(socket) //line 115 calls line 402(line 168)
        else infoDisplay.innerHTML = "Please place all ships"
      }) //sends a reminder if doesn't place all 5 ships
  
      // Setup event listeners for firing
      computerSquares.forEach(square => {
        square.addEventListener('click', () => { //When a square is clicked, the event listener triggers a function that checks if certain conditions are met
          if(currentPlayer === 'user' && ready && enemyReady) { //if it's the user's turn, ready flag status is true & enemyReady flag status is true
            shotFired = square.dataset.id //variable shotFired = value of the id data attribute of the clicked square (square.dataset.id)
            socket.emit('fire', shotFired) //emits a 'fire' event using a socket with the shotFired value
          }
        })
      })
  
      // On Fire Received
      socket.on('fire', id => { //When the client receives a 'fire' event from the server, 
        enemyGo(id) //it triggers this function, which likely handles the enemy's move based on the received id
        const square = userSquares[id] //gets the user square corresponding to the received id
        socket.emit('fire-reply', square.classList) //emits a 'fire-reply' event back to the server with the classList of the user square
        playGameMulti(socket) //line 402
      })
  
      // On Fire Reply Received
      socket.on('fire-reply', classList => { //When the client receives a 'fire-reply' event from the server, it triggers the revealSquare(classList) function, 
        revealSquare(classList) //which reveals the square based on the received classList
        playGameMulti(socket) //line 402
      })
  
      function playerConnectedOrDisconnected(num) { //takes a number(num) as an argument
        let player = `.p${parseInt(num) + 1}` //constructs a `CSS selector string` based on the num by adding 1 to the num and creating a class selector string like .pX where X is num + 1
        document.querySelector(`${player} .connected`).classList.toggle('active') //selects the element with the class connected.toggles the class active on that element
        if(parseInt(num) === playerNum) document.querySelector(player).style.fontWeight = 'bold'
      }//If the input number is equal to the global variable playerNum (line 112), sets the font weight of the element matching the constructed CSS selector to 'bold'
    } //function startMultiPlayer (line 167) ends here
  
    // Single Player
    function startSinglePlayer() {//set up the game for single-player mode
      generate(shipArray[0]) //generate function is called 5 times with the different ship objects from the shipArray to generate ships on the game board
      generate(shipArray[1])
      generate(shipArray[2])
      generate(shipArray[3])
      generate(shipArray[4])
  
      startButton.addEventListener('click', () => { //When the button is clicked, it hides the setupButtons element and calls the playGameSingle function to start the game
        setupButtons.style.display = 'none'
        playGameSingle()
      })
    } //function startSinglePlayer ends here 
  
    //Create Board
    function createBoard(grid, squares) { //grid element where the squares will be appended, an array that will store the individual square elements created
      for (let i = 0; i < width*width; i++) { //create a square element for each cell on the game board
        const square = document.createElement('div') //A new <div> element is created for each square
        square.dataset.id = i //set to the index i to uniquely identify each square
        grid.appendChild(square) //square element is appended to the specified grid
        squares.push(square) //square element is added to the squares array
      }
    } //function createBoard ends here 
  
    //Draw the computers ships in random locations
    function generate(ship) { //randomly generate the position of a ship on the game board
      let randomDirection = Math.floor(Math.random() * ship.directions.length) //generates a random direction for the ship by selecting a random index from the ship.directions array
      let current = ship.directions[randomDirection] // determines the current (direction) based on the randomly selected index
      if (randomDirection === 0) direction = 1 
      if (randomDirection === 1) direction = 10 
      let randomStart = Math.abs(Math.floor(Math.random() * computerSquares.length - (ship.directions[0].length * direction))) //calculates a random starting position for the ship on the game board
  
      const isTaken = current.some(index => computerSquares[randomStart + index].classList.contains('taken')) //checks if the positions where the ship will be placed are not already taken by another ship (isTaken), 
      const isAtLeftEdge = current.some(index => (randomStart + index) % width === 0) //and not at the left edge of the board (isAtLeftEdge)
      const isAtRightEdge = current.some(index => (randomStart + index) % width === width - 1) //not at the right edge of the board (isAtRightEdge), 
  //If the conditions are met, it adds the ship to the game board by adding the ('taken', and the ship's name (ship.name)) as a class to the corresponding grid squares.
      if (!isTaken && !isAtRightEdge && !isAtLeftEdge) current.forEach(index => computerSquares[randomStart + index].classList.add('taken', ship.name))
  //otherwise, try again
      else generate(ship) //ships need to be randomly placed on the board without overlapping or going out of bounds
    }//function generate ends here
    
  
    //Rotate the ships
    function rotate() {
      if (isHorizontal) { //checks the value of the variable isHorizontal (line 108). If true, it means the element(s) are currently displayed horizontally
        destroyer.classList.toggle('destroyer-container-vertical') //if true, toggles the class 
        submarine.classList.toggle('submarine-container-vertical') //classList CSS styles to make the elements appear vertically instead
        cruiser.classList.toggle('cruiser-container-vertical')
        battleship.classList.toggle('battleship-container-vertical')
        carrier.classList.toggle('carrier-container-vertical')
        isHorizontal = false //changes this variable from true (line 108) to false
        console.log(isHorizontal)
        return
      }
      if (!isHorizontal) { //if vertical instead
        destroyer.classList.toggle('destroyer-container-vertical') //toggles the classes back to horizontal orientation by removing the -vertical classes
        submarine.classList.toggle('submarine-container-vertical')
        cruiser.classList.toggle('cruiser-container-vertical')
        battleship.classList.toggle('battleship-container-vertical')
        carrier.classList.toggle('carrier-container-vertical')
        isHorizontal = true //changes this variable from false (line 108) to true 
        console.log(isHorizontal)
        return
      } //function is bound to the click event of an element with the id rotateButton, 
    }//so when that button is clicked, the rotate() function is executed, causing the elements to change orientation
    rotateButton.addEventListener('click', rotate) //calls function from line 297
  
    //move around user ship (line 322); userSquares is initially an empty array [ ]
    ships.forEach(ship => ship.addEventListener('dragstart', dragStart)) //adds a "dragstart" event listener to each element with the class "ship", calling the dragStart function (ine 249) when the drag operation starts on those elements
    userSquares.forEach(square => square.addEventListener('dragstart', dragStart)) //adds a "dragstart" event listener to each element in the userSquares array, calling the dragStart function (ine 249)
    userSquares.forEach(square => square.addEventListener('dragover', dragOver)) //adds a "dragover" event listener to each element in the userSquares array, calling the dragOver function (ine 255)
    userSquares.forEach(square => square.addEventListener('dragenter', dragEnter)) //adds a "dragenter" event listener to each element in the userSquares array, calling the dragEnter function (ine 259)
    userSquares.forEach(square => square.addEventListener('dragleave', dragLeave)) //adds a "dragleave" event listener to each element in the userSquares array, calling the dragLeave function (ine 263)
    userSquares.forEach(square => square.addEventListener('drop', dragDrop)) //adds a "drop" event listener to each element in the userSquares array, calling the dragDrop function (ine 267)
    userSquares.forEach(square => square.addEventListener('dragend', dragEnd)) //adds a "dragend" event listener to each element in the userSquares array, calling the dragEnd function (ine 307)
  
    let selectedShipNameWithIndex
    let draggedShip
    let draggedShipLength
  
    ships.forEach(ship => ship.addEventListener('mousedown', (e) => {
      selectedShipNameWithIndex = e.target.id
      // console.log(selectedShipNameWithIndex)
    })) //function ends here
  
    function dragStart() {
      draggedShip = this
      draggedShipLength = this.childNodes.length
      // console.log(draggedShip)
    }
  
    function dragOver(e) {
      e.preventDefault()
    }
  
    function dragEnter(e) {
      e.preventDefault()
    }
  
    function dragLeave() {
      // console.log('drag leave')
    }
  //dragDrop function is triggered when a ship is dropped onto a grid square.
    function dragDrop() { //drag and drop functionality for placing ships on a grid
      let shipNameWithLastId = draggedShip.lastChild.id // Variable = extracts the last character of the ship's ID to determine the ship's class and index
      let shipClass = shipNameWithLastId.slice(0, -2) 
       console.log(shipClass)
      let lastShipIndex = parseInt(shipNameWithLastId.substr(-1)) // calculates the new position where the ship will be placed based on the grid square where it was dropped
      let shipLastId = lastShipIndex + parseInt(this.dataset.id)
       console.log(shipLastId)
  //defines arrays of grid positions that are not allowed for ships to be placed horizontally and vertically
      const notAllowedHorizontal = [0,10,20,30,40,50,60,70,80,90,1,11,21,31,41,51,61,71,81,91,2,22,32,42,52,62,72,82,92,3,13,23,33,43,53,63,73,83,93]
      const notAllowedVertical = [99,98,97,96,95,94,93,92,91,90,89,88,87,86,85,84,83,82,81,80,79,78,77,76,75,74,73,72,71,70,69,68,67,66,65,64,63,62,61,60]
  //adjusts these arrays based on the length and position of the ship being dragged
      let newNotAllowedHorizontal = notAllowedHorizontal.splice(0, 10 * lastShipIndex)
      let newNotAllowedVertical = notAllowedVertical.splice(0, 10 * lastShipIndex)
  
      selectedShipIndex = parseInt(selectedShipNameWithIndex.substr(-1)) 
  //checks if the ship can be placed horizontally or vertically based on the drag direction and the allowed positions
      shipLastId = shipLastId - selectedShipIndex
       console.log(shipLastId)
  //If the ship can be placed, it adds CSS classes to the grid squares to visually represent the ship (id from line 373)
      if (isHorizontal && !newNotAllowedHorizontal.includes(shipLastId)) {
        for (let i=0; i < draggedShipLength; i++) { //removes the dragged ship (draggedShipLength) from the display grid
          let directionClass 
          if (i === 0) directionClass = 'start'
          if (i === draggedShipLength - 1) directionClass = 'end'
          userSquares[parseInt(this.dataset.id) - selectedShipIndex + i].classList.add('taken', 'horizontal', directionClass, shipClass)
        } //Tracks which squares have been taken to avoid overlapping
      //As long as the index of the ship you are dragging is not in the newNotAllowedVertical array! This means that sometimes if you drag the ship by its
      //index-1 , index-2 and so on, the ship will rebound back to the displayGrid.
      } else if (!isHorizontal && !newNotAllowedVertical.includes(shipLastId)) { 
        for (let i=0; i < draggedShipLength; i++) {
          let directionClass
          if (i === 0) directionClass = 'start'
          if (i === draggedShipLength - 1) directionClass = 'end'
          userSquares[parseInt(this.dataset.id) - selectedShipIndex + width*i].classList.add('taken', 'vertical', directionClass, shipClass)
        }
      } else return
  
      displayGrid.removeChild(draggedShip) //checks if all ships have been placed on the grid
      if(!displayGrid.querySelector('.ship')) allShipsPlaced = true
    } //if so, then status of allShipsPlaced (line 395) changes from false to true
  
    function dragEnd() {
       console.log('dragend')
    }
  
    // Game Logic for MultiPlayer
    function playGameMulti(socket) {
      setupButtons.style.display = 'none' //hides the setup buttons by setting their display property to 'none'.
      if(isGameOver) return //when game over, returns early and does not execute the rest of the function
      if(!ready) { //if not ready, it emits a 'player-ready' event via the socket and sets the player as ready
        socket.emit('player-ready')
        ready = true
        playerReady(playerNum)
      } //to line 332
  
      if(enemyReady) { //if opponent is ready, it updates the turn display to show whose turn it is
        if(currentPlayer === 'user') { //if it's your turn, then tells you
          turnDisplay.innerHTML = 'Your Go'
        }
        if(currentPlayer === 'enemy') { //if it's their turn, then tells you
          turnDisplay.innerHTML = "Enemy's Go"
        }
      }
    }//function ends here
  //marking a player as ready in a multiplayer game
    function playerReady(num) { 
      let player = `.p${parseInt(num) + 1}` //constructs a CSS selector based on the player number passed as an argument
      document.querySelector(`${player} .ready`).classList.toggle('active')
    } //select line 423 variable.gives class 'ready'. toggle (if the 'active' class is not present, it will be added, and if it is present, it will be removed)
  
    // Game Logic for Single Player
    function playGameSingle() {
      if (isGameOver) return //checks if the game is over which will end the function early
      if (currentPlayer === 'user') { //line 110
        turnDisplay.innerHTML = 'Your Go' //from line 104. If the current player is the user, updates the text displayed on the turnDisplay element to indicate that it's the user's turn
        computerSquares.forEach(square => square.addEventListener('click', function(e) { //from line 107 [empty array].iterates over each square in the array, adds an event listener for a click event on each square
          shotFired = square.dataset.id //When a square is clicked, shotFired variable = data-id attribute of the clicked square 
          revealSquare(square.classList)//and calls the revealSquare() function with the classList of the square
        })) //function on line 449
      }
      if (currentPlayer === 'enemy') { //If the current player is the enemy, 
        turnDisplay.innerHTML = 'Computers Go' //it updates the text displayed on the turnDisplay element to indicate that it's the computer's turn
        setTimeout(enemyGo, 1000) //schedules the enemyGo function to be called after a delay of 1 second
      } //function at line 478
    }
  //initializes counts for different types of ships
    let destroyerCount = 0
    let submarineCount = 0
    let cruiserCount = 0
    let battleshipCount = 0
    let carrierCount = 0
  //function (takes a classList parameter)
    function revealSquare(classList) { 
  //finds the enemy square on the computer grid based on the shotFired value
      const enemySquare = computerGrid.querySelector(`div[data-id='${shotFired}']`) //declare var (class) Object: ObjectConstructor
      const obj = Object.values(classList) //converts the classList object into an array
      if (!enemySquare.classList.contains('boom') && currentPlayer === 'user' && !isGameOver) {
  //If the enemy square doesn't already contain the 'boom' class, it hasn't been used yet, so the current player is the user, and the game is not over
        if (obj.includes('destroyer')) destroyerCount++ //increments the count for each ship type 
        if (obj.includes('submarine')) submarineCount++ //if the class list includes the corresponding ship type
        if (obj.includes('cruiser')) cruiserCount++
        if (obj.includes('battleship')) battleshipCount++
        if (obj.includes('carrier')) carrierCount++
      }
      if (obj.includes('taken')) { //If the obj class list. includes ('taken'), 
        enemySquare.classList.add('boom') //it adds the 'boom' class to the enemy square; 
      } else { //otherwise, it adds the 'miss' class
        enemySquare.classList.add('miss')
      }
      checkForWins() //line 498
      currentPlayer = 'enemy' //changes the current player to 'enemy',
      if(gameMode === 'singlePlayer') playGameSingle() //line 428
    } //if the game mode is 'singlePlayer', it proceeds to play the game for the enemy
  
    let cpuDestroyerCount = 0
    let cpuSubmarineCount = 0
    let cpuCruiserCount = 0
    let cpuBattleshipCount = 0
    let cpuCarrierCount = 0
  
  
    function enemyGo(square) {
  //checks if the gameMode is set to 'singlePlayer'. If it is, the square variable is assigned a random value between 0 and the length of userSquares array
      if (gameMode === 'singlePlayer') square = Math.floor(Math.random() * userSquares.length) // [ length of empty array ]
  //checks if the square selected by the CPU (enemy) does not already contain the class 'boom'  
      if (!userSquares[square].classList.contains('boom')) {
  //If it doesn't, it proceeds to mark the square with either 'boom' or 'miss' classes based on whether it's a hit or a miss.
        const hit = userSquares[square].classList.contains('taken')
        userSquares[square].classList.add(hit ? 'boom' : 'miss')
        if (userSquares[square].classList.contains('destroyer')) cpuDestroyerCount++ //If the square contains one of the ship classes
        if (userSquares[square].classList.contains('submarine')) cpuSubmarineCount++ //it increments the corresponding CPU ship count variables
        if (userSquares[square].classList.contains('cruiser')) cpuCruiserCount++
        if (userSquares[square].classList.contains('battleship')) cpuBattleshipCount++
        if (userSquares[square].classList.contains('carrier')) cpuCarrierCount++
        checkForWins() //line 498
  //If the square selected by the CPU is already marked with 'boom' class (line 482) and the gameMode is 'singlePlayer' (line 480), 
      } else if (gameMode === 'singlePlayer') enemyGo() //it recursively calls enemyGo() again to select a new square
      currentPlayer = 'user' //it sets the currentPlayer to 'user' and 
      turnDisplay.innerHTML = 'Your Go' 
    }//updates the turnDisplay element to indicate that it's the user's turn with the message 'Your Go'
  //check if any player has won the game
    function checkForWins() { 
      let enemy = 'computer' //sets the enemy variable to 'computer' by default
      if(gameMode === 'multiPlayer') enemy = 'enemy' //if the game mode is 'multiPlayer', it changes the enemy variable to 'enemy'
  //check if any of the ships have been sunk
      if (destroyerCount === 2) { //checks if the player's ships has been sunk
        infoDisplay.innerHTML = `You sunk the ${enemy}'s destroyer` //updates the infoDisplay with the corresponding message
        destroyerCount = 10
      } //total count of all ships is 50 (10*5) Why does it need to count to 50 instead of 17? 
      if (submarineCount === 3) {
        infoDisplay.innerHTML = `You sunk the ${enemy}'s submarine`
        submarineCount = 10
      }
      if (cruiserCount === 3) {
        infoDisplay.innerHTML = `You sunk the ${enemy}'s cruiser`
        cruiserCount = 10
      }
      if (battleshipCount === 4) {
        infoDisplay.innerHTML = `You sunk the ${enemy}'s battleship`
        battleshipCount = 10
      }
      if (carrierCount === 5) {
        infoDisplay.innerHTML = `You sunk the ${enemy}'s carrier`
        carrierCount = 10
      }
      if (cpuDestroyerCount === 2) { //checks if any of the computer's ships have been sunk
        infoDisplay.innerHTML = `${enemy} sunk your destroyer`
        cpuDestroyerCount = 10
      }
      if (cpuSubmarineCount === 3) {
        infoDisplay.innerHTML = `${enemy} sunk your submarine`
        cpuSubmarineCount = 10
      }
      if (cpuCruiserCount === 3) {
        infoDisplay.innerHTML = `${enemy} sunk your cruiser`
        cpuCruiserCount = 10
      }
      if (cpuBattleshipCount === 4) {
        infoDisplay.innerHTML = `${enemy} sunk your battleship`
        cpuBattleshipCount = 10
      }
      if (cpuCarrierCount === 5) {
        infoDisplay.innerHTML = `${enemy} sunk your carrier`
        cpuCarrierCount = 10
      }
  //checks if the player has won the game based on the count of the ships
      if ((destroyerCount + submarineCount + cruiserCount + battleshipCount + carrierCount) === 50) {
        infoDisplay.innerHTML = "YOU WIN"
        gameOver() //line 553
      } //all the computer's ships have been sunk, displays that the enemy (computer or player) wins
      if ((cpuDestroyerCount + cpuSubmarineCount + cpuCruiserCount + cpuBattleshipCount + cpuCarrierCount) === 50) {
        infoDisplay.innerHTML = `${enemy.toUpperCase()} WINS`
        gameOver()//line 553
      }
    }
  
    function gameOver() {//prevents further gameplay interactions
      isGameOver = true //indicates that the game is over
      startButton.removeEventListener('click', playGameSingle) //function to line 428
    } //line 101.removes an event listener from the startButton element(event listener being removed is for the 'click' event, and the function playGameSingle that was previously attached to handle the click event)
  }) //By removing this event listener, the playGameSingle function will no longer be triggered when the startButton is clicked, effectively disabling the game functionality associated with that button
