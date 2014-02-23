//Canvas stuff
var canvas = {};
canvas.element = $("#canvas")[0];
canvas.context = canvas.element.getContext("2d");
canvas.width = $("#canvas").width();
canvas.height = $("#canvas").height();

//Debug stuff
var DEBUG_MODE = false;

//Sharing stuff
var ANGLECHAR_ID = 'angle_room';
var QUERY_REGEX = new RegExp('\\?(.*)\\b' + ANGLECHAR_ID + '=([^&#\/]*)(.*)');
var roomName;
var query;

//User stuff
var myUserId;
var myUserName;

//Defaults
var ANGLE_APP_URL = 'https://goinstant.net/5ad9da5ff88e/swag420yolo';
var ANGLER_SPEED = 100;
var ANGLER_COOLDOWN = 10;
var CIRCLE_DIAMETER = 160;
var DEFAULT_POSITION = 2;
var INITIAL_SCORE = 0;
var BLOCK_SIZE = 10;

// obstacles for later versions
var obstacles = {};

// circles
var circles = {};
var circleKey;

var lobby;
var el = {};
var teamScore;

function updateHUD() {
  el.userScore.text(circles[myUserId].currentScore);
  el.teamScore.text(teamScore);
}


function initializeCircle(cb) {
  circles[myUserId] = {
    currentScore: INITIAL_SCORE,
    position: DEFAULT_POSITION,
    side: '',
    REPLACEMEUSELESSCODE: ''
  };
  updateHUD();

  // NO COLORS BUT CHOOSE SPECIFIC CIRCLE
  var userColors = new goinstant.widgets.UserColors({ room: lobby });
  userColors.choose(function(err, color) {
    if (err) {
      throw err;
    }

    $('.user-label').css('background-color',color);

    // set that as their snake color
  /*  snakes[myUserId].color = color;

    for(var x = 0; x < snakes[myUserId].length; x++) {
      snakes[myUserId].blocks[x] = { x: 0, y: 0 };
    }*/
    var circleListener = function(val, context) {
      var username = context.key.substr('/circles/'.length);
      circles[username] = context.value;
    };
    circleKey.on('set', { bubble:true, listener: circleListener });
    circleKey.key("/" + myUserId).set(circles[myUserId], function(err) {
      if (err) {
        throw err;
      }
      circleKey.get(function(err, value, context) {
        if (err) {
          throw err;
        }
        circles = value;
        spawnCircle(myUserId);
        return cb();
      });
    });
  });
}
function initializeHighScore(cb) {
  var teamScoreKey = lobby.key('/teamScore');
  teamScoreKey.on('set', function(val, context) {
    teamScore = val;
  }.bind(this));
  teamScoreKey.get(function(err, val) {
    if (err) {
      throw err;
    }
    teamScore = val ? val : 0;
    return cb();
  });
}

function initializeGame() {
  if (setRoomName()) {
    goinstant.connect(ANGLE_APP_URL, { room: roomName }, function(err, platform, room) {
      if (err) {
        throw err;
      }
      lobby = room;

      circleKey = lobby.key('/circles');

      async.series([
        initializeUser,
       // initializeFood,
        initializeHighScore,
        initializeCircle,
        initializeNotifications,
        initializeGameLoop,
        initializeSharing
      ], function(err) {
        if (err) {
          throw err;
        }
      });
    });
  }
}

function initializeSharing(cb) {
  var parser = document.createElement('a');
  parser.href = window.location.toString();

  // Create the sharing URL by adding the roomName as a query parameter to
  // the current window.location.
  if (parser.search) {
    parser.search += '&' + ANGLECHAR_ID + '=' + roomName;
  } else {
    parser.search = '?' + ANGLECHAR_ID + '=' + roomName;
  }

  // Create Share Button
  addShareButton(parser.href);
}

function addShareButton(text) {
  var shareBtn = document.createElement('div');
  $(shareBtn).addClass('share-btn');
  
  shareBtn.innerHTML = '<input id="gi-share-text" type="text" value="' + text + '"/>';
  
  var shareBtnWrap = $('.invite-a-friend')[0];
  //main.parentNode.insertBefore(shareBtn, main);
  $(shareBtnWrap).append(shareBtn);

  // Ask to share
  if(inSharedRoom() == false) {
    $('#facebook-link').attr("href", "http://www.facebook.com/sharer.php?src=sp&u=" + encodeURIComponent(text));
    $('#twitter-link').attr("href", "https://twitter.com/intent/tweet?text=" + encodeURIComponent("Come play multiplayer snakes against me on GoSnake. " + text) +"&source=goinstant");
    $("#modal-outer").show();
  }
}

function inSharedRoom() {
  var field = 'angle_room';
  var url = window.location.href;
  if(url.indexOf('?' + field + '=') != -1)
      return true;
  else if(url.indexOf('&' + field + '=') != -1)
      return true;
  return false
}

function setRoomName() {
  // if we have the go-SNAKE room in sessionStorage then just connect to
  // the room and continue with the initialization.
  roomName = sessionStorage.getItem(ANGLECHAR_ID);
  if (roomName) {
    return true;
  }

  // if we do not have the name in storage then check to see if the window
  // location contains a query string containing the id of the room.

  // creating an anchor tag and assigning the href to the window location
  // will automatically parse out the URL components ... sweet.
  var parser = document.createElement('a');
  parser.href = window.location.toString();

  var hasRoom = QUERY_REGEX.exec(parser.search);
  var roomId = hasRoom && hasRoom[2];
  if (roomId) {
    roomName = roomId.toString();
    // add the cookie to the document.
    sessionStorage.setItem(ANGLECHAR_ID, roomName);

    // regenerate the URI without the go-SNAKE query parameter and reload
    // the page with the new URI.
    var beforeRoom = hasRoom[1];
    if (beforeRoom[beforeRoom.length - 1] === '&') {
      beforeRoom = beforeRoom.slice(0, beforeRoom.lengh - 1);
    }
    var searchStr = beforeRoom + hasRoom[3];
    if (searchStr.length > 0) {
      searchStr = '?' + searchStr;
    }

    parser.search = searchStr;

    // set the new location and discontinue the initialization.
    window.location = parser.href;
    return false;
  }

  // there is no room to join for this SNAKE so simply create a new
  // room and set the cookie in case of future refreshes.
  var id = Math.floor(Math.random() * Math.pow(2, 32));
  roomName = id.toString();
  sessionStorage.setItem(ANGLECHAR_ID, roomName);

  return true;
}

// If the user is unknown to us, try to get a username
function initializeUser(cb) {
  myUserName = sessionStorage.getItem('gi_username');
  if (!myUserName) {
    myUserName = prompt('What is your name?', 'Guest');
    if (!myUserName){
      myUserName = 'Guest';
    }
    sessionStorage.setItem('gi_username', myUserName);
  }
  
  var userListElement = $('.user-list-container')[0];

  var userList = new goinstant.widgets.UserList({
    room: lobby,
    collapsed: false,
    position: 'right',
    container: userListElement
  });
  lobby.self().get(function(err, val, userKey) {
    if (err) {
      throw err;
    }
    myUserId = val.id;

    var displayNameKey = lobby.self().key('displayName');
    displayNameKey.set(myUserName, function(err) {
      if (err) {
        throw err;
      }
      userList.initialize(function(err) {
        return cb();
      });
    });
  });
} 

function initializeNotifications(cb) {

  var notifications = new goinstant.widgets.Notifications();

  // Get all notifications of users joining
  notifications.subscribe(lobby, function(err) {
    if (err) {
      throw err;
    }

    // publish a notification of the new user
    var msg = myUserName + ' has joined.';
    notifications.publish({
      room: lobby,
      type: 'success',
      message: msg,
      displayToSelf: true
    }, function(err) {
      if (err) {
        throw err;
      }
      return cb();
    });
  });
}

function initializeGameLoop(cb) {
  if(typeof gameTimer != "undefined") {
    clearInterval(gameTimer);
  }
  gameTimer = setInterval(gameTick, 60);
  return cb();
}
/*
function initializeFood(cb) {
  food = {
    key: lobby.key('/food'),
    color: 'black',
    position: {
      x: 0,
      y: 0
    }
  };
  var foodListener = function(val) {
    food.position = val;
  };

  food.key.on('set', { local: true, listener: foodListener });
  food.key.get(function(err, value, context) {
    if (value) {
      food.position = value;
      return cb();
    }
    spawnFood(cb);
  });
}
*/
function gameTick() {
  //Draw the canvas all the time to avoid trails.
  drawCanvas();
 // drawFood();

  //Move snakes & detect collisions
  _.each(_.keys(circles), function(username) {
    var currentCircle = circles[username];

    drawCircle(currentCircle);
   // incrementSnakePosition(username);

    // only with our snake
    if(username == myUserId) {
/*
      if (checkWallCollision(username)) {
        spawnCircle(username);
      }

      // This will prevent all other players from respawning the food
      if (checkFoodCollision(username)) {

        increaseSnakeLength(username);
        spawnFood(null);
        currentCircle.currentScore++;
        updateHighScore(username);
        updateHUD();
      }*/
    }
  });
}
/*
function incrementSnakePosition(username) {
  var currentCircle = snakes[username];
    switch(currentCircle.REPLACEMEUSELESSCODE) {
      case 'up':
        currentCircle.blocks[0].y--;
        break;
      case 'down':
        currentCircle.blocks[0].y++;
        break;
      case 'left':
        currentCircle.blocks[0].x--;
        break;
      case 'right':
        currentCircle.blocks[0].x++;
        break;
  }
}
*/
/*
function increaseSnakeLength(username) {
  var currentCircle = circles[username];
  currentCircle.length++;

  currentCircle.blocks[currentCircle.length-1] = {
    x: currentCircle.blocks[currentCircle.length-2].x,
    y: currentCircle.blocks[currentCircle.length-2].y
  };

  switch(currentCircle.REPLACEMEUSELESSCODE) {
    case 'up':
      currentCircle.blocks[currentCircle.length-1].y--;
      break;
    case 'down':
      currentCircle.blocks[currentCircle.length-1].y++;
      break;
    case 'left':
      currentCircle.blocks[currentCircle.length-1].x--;
      break;
    case 'right':
      currentCircle.blocks[currentCircle.length-1].x++;
      break;
    default:
      throw new Error("invalid snake REPLACEMEUSELESSCODE");
  }
}*/
/*
function drawFood() {
  canvas.context.beginPath();
  canvas.context.fillStyle = food.color;
  canvas.context.fillRect((food.position.x*BLOCK_SIZE), (food.position.y*BLOCK_SIZE), BLOCK_SIZE, BLOCK_SIZE);
  canvas.context.stroke();
}
*/
function drawCircle(currentCircle) {
  var img = new Image();
  img.onload = function(){
      //FIX: REPLACE 20 WITH SIDE VARIABLE
    canvas.context.drawImage(img, 20, currentCircle.position*110);
  }
  img.src = "./img/obtuse_medium.png";

 /* canvas.context.fillStyle = currentCircle.color;
  for(var x = currentCircle.length-1; x >= 0; x--) {
    if(typeof(currentCircle.blocks[x].x) != 'undefined' && typeof(currentCircle.blocks[x].y) != 'undefined') {
      canvas.context.fillRect((currentCircle.blocks[x].x*BLOCK_SIZE), (currentCircle.blocks[x].y*BLOCK_SIZE), BLOCK_SIZE, BLOCK_SIZE);

      //Inherit past position, only on our snake
      if(x > 0) {
        currentCircle.blocks[x].x = currentCircle.blocks[x-1].x;
        currentCircle.blocks[x].y = currentCircle.blocks[x-1].y;
      }
    }
  }*/
}
/*
// this will get rid of other snakes from lost connections, etc.
function checkWallCollision(username) {
  var currentCircle = snakes[username];

  if (currentCircle.blocks[0].y < 0 ||
       currentCircle.blocks[0].y > (canvas.height/BLOCK_SIZE) ||
       currentCircle.blocks[0].x < 0 ||
       currentCircle.blocks[0].x > (canvas.width/BLOCK_SIZE)) {
    return true;
  }
  return false;
}*/
/*
function checkFoodCollision(username) {
  var currentCircle = snakes[username];
  if(currentCircle.blocks[0].y == food.position.y && currentCircle.blocks[0].x == food.position.x) {
    return true;
  }
  return false;
}
*/

// FIX THIS FUNCTION NOT WORKING
function updateHighScore(userName) {
  var currentCircle = circles[userName];
  if(teamScore < currentCircle.currentScore) {
    teamScore = currentCircle.currentScore;
    lobby.key('/teamScore').set(teamScore, function(err) {
      if(err) {
        throw err;
      }
    });
  }
}

function spawnCircle(circleUsername) {
  //spawn a new instance of the snake & destroy the old
  var currentCircle = circles[circleUsername];

  //Set length to default
  //currentCircle.length = INITIAL_SNAKE_LENGTH;

  //Did the user hit a high score?
  //updateHighScore(circleUsername);

  //Reset score
  currentCircle.currentScore = INITIAL_SCORE;
  updateHUD();

  //Find new spawn location
  /*var newPos = {
    x: Math.round(Math.random()*(canvas.width-BLOCK_SIZE)/BLOCK_SIZE),
    y: Math.round(Math.random()*(canvas.height-BLOCK_SIZE)/BLOCK_SIZE)
  };*/
/*
  //Set new REPLACEMEUSELESSCODE
  switch(Math.round(Math.random()*3)) {
    case 0:
      currentCircle.REPLACEMEUSELESSCODE = 'up';
      break;
    case 1:
      currentCircle.REPLACEMEUSELESSCODE = 'down';
      break;
    case 2:
      currentCircle.REPLACEMEUSELESSCODE = 'left';
      break;
    case 3:
      currentCircle.REPLACEMEUSELESSCODE = 'right';
      break;
  }

  //Setup new snake blocks
  currentCircle.blocks[0].x = newPos.x;
  currentCircle.blocks[0].y = newPos.y;

  for(var x = 1; x < currentCircle.length; x++) {
    currentCircle.blocks[x].x = currentCircle.blocks[x-1].x;
    currentCircle.blocks[x].y = currentCircle.blocks[x-1].y;

    switch(currentCircle.REPLACEMEUSELESSCODE){
      case 'up':
        currentCircle.blocks[x].y++;
        break;
      case 'down':
        currentCircle.blocks[x].y--;
        break;
      case 'right':
        currentCircle.blocks[x].x--;
        break;
      case 'left':
        currentCircle.blocks[x].x++;
        break;
      default:
        throw new Error("invalid snake REPLACEMEUSELESSCODE");
    }
  }
*/
  this.circleKey.key("/" + myUserId).set(currentCircle, function(err) {
    if(err) throw err;
  });
}

function drawDebugCanvas() {
  for(var x=0; x<(canvas.width/10); x++) {
    for(var y=0; y<(canvas.height/10); y++) {
      canvas.context.fillStyle = "white";
      canvas.context.fillRect((x*10), (y*10), 10, 10);
    }
  }
}

function drawCanvas() {
  if (DEBUG_MODE) {
    drawDebugCanvas();
  } else {
    canvas.context.fillStyle = "white";
    canvas.context.fillRect(0, 0, canvas.width, canvas.height);
  }
}
/*
function spawnFood(cb) {
  food.position.x = Math.round(Math.random()*(canvas.width-BLOCK_SIZE)/BLOCK_SIZE);
  food.position.y = Math.round(Math.random()*(canvas.height-BLOCK_SIZE)/BLOCK_SIZE);
  food.key.remove(function(err) {
    food.key.set(food.position, { overwrite: false },function(err) {
      if (err) {
        if (err instanceof goinstant.errors.CollisionError) {
          // mutex was already set by someone else, exit...
          return cb();
        }
        throw err;
      }
      if (cb) {
        return cb();
      }
    });
  });
}
*/
$(document).ready(function () {
  el.userScore = $(".user-score.score");
  el.teamScore = $(".high-score .score");
  // Init GoInstant

  initializeGame();

  // modal close
  $(".close").click(function() {
    $("#modal-outer").hide();
  });
});

$(window).on('beforeunload', function(){
  circleKey.key("/" + myUserId).remove(function(err, value, context) {
    if (err) {
      throw err;
    }
  });
});
/*
var arrowKeys=new Array(37,38,39,40);

// Keyboard Controls
$(document).keydown(function(e){
  var key = e.which;
  var currentCircle = circles[myUserId];
  if(key == "37" && currentCircle.REPLACEMEUSELESSCODE != "right") {
    currentCircle.REPLACEMEUSELESSCODE = "left";
  } else if(key == "38" && currentCircle.REPLACEMEUSELESSCODE != "down") {
    currentCircle.REPLACEMEUSELESSCODE = "up";
  } else if(key == "39" && currentCircle.REPLACEMEUSELESSCODE != "left") {
    currentCircle.REPLACEMEUSELESSCODE = "right";
  } else if(key == "40" && currentCircle.REPLACEMEUSELESSCODE != "up") {
    currentCircle.REPLACEMEUSELESSCODE = "down";
  }

  if($.inArray(key,arrowKeys) > -1) {
    e.preventDefault();
  }

  if (myUserId && currentCircle) {
    circleKey.key("/" + myUserId).set(currentCircle, function(err) {
      if(err) {
        throw err;
      }
    });
  }
});
*/