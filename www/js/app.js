var couchbaseApp = angular.module("starter", ["ionic", "ngCouchbaseLite"]);

var todoDatabase = null;

couchbaseApp.config(function($stateProvider, $urlRouterProvider) {
    $stateProvider
        .state("todoLists", {
            url: "/todoLists",
            templateUrl: "templates/todolists.html",
            controller: "TodoListsController"
        })
        .state("tasks", {
            url: "/tasks/:listId",
            templateUrl: "templates/tasks.html",
            controller: "TaskController"
        });
    $urlRouterProvider.otherwise("/todoLists");
});



couchbaseApp.run(function($ionicPlatform, $couchbase) {
    $ionicPlatform.ready(function() {
        // 1
        if (!window.cblite) {
            alert("Couchbase Lite is not installed!");
        } else {
            cblite.getURL(function(err, url) {
                if (err) {
                    alert("There was an error getting the database URL");
                    return;
                }
                todoDatabase = new $couchbase(url, "todo");
                // 2
                todoDatabase.createDatabase().then(function(result) {
                    var todoViews = {
                        lists: {
                            map: function(doc) {
                                if (doc.type == "list" && doc.title) {
                                    emit(doc._id, {
                                        title: doc.title,
                                        rev: doc._rev
                                    })
                                }
                            }.toString()
                        },
                        tasks: {
                            map: function(doc) {
                                if (doc.type == "task" && doc.title && doc.list_id) {
                                    emit(doc.list_id, {
                                        title: doc.title,
                                        list_id: doc.list_id,
                                        rev: doc._rev
                                    })
                                }
                            }.toString()
                        }
                    };
                    todoDatabase.createDesignDocument("_design/todo", todoViews);
                    todoDatabase.listen();
                }, function(error) {
                    // There was an error creating the database
                });
            });
        }
    });
});



couchbaseApp.controller("TodoListsController", function($scope, $state, $ionicPopup, $couchbase, $rootScope) {

    $scope.lists = {};

    $scope.insert = function() {
        $ionicPopup.prompt({
                title: 'Enter a new TODO list',
                inputType: 'text'
            })
            .then(function(result) {
                var obj = {
                    title: result,
                    type: "list",
                };
                todoDatabase.createDocument(obj).then(function(result) {
                    // The document was saved
                }, function(error) {
                    // There was an error saving the document
                });
            });
    };


    $scope.delete = function(list) {
        var listId = list._id;
        todoDatabase.deleteDocument(list._id, list._rev).then(function(result) {
            todoDatabase.queryView("_design/todo", "tasks", {
                "start_key": listId
            }).then(function(result) {
                for (var i = 0; i < result.rows.length; i++) {
                    todoDatabase.deleteDocument(result.rows[i].id, result.rows[i].value.rev);
                }
            }, function(error) {
                // There was an error querying the view
            });
        }, function(error) {
            // There was an error deleting the list document
        });
    };


    todoDatabase.queryView("_design/todo", "lists").then(function(result) {
        for (var i = 0; i < result.rows.length; i++) {
            $scope.lists[result.rows[i].id] = result.rows[i].value;
        }
    }, function(error) {
        // There was an error querying the view
    });

    $rootScope.$on("couchbase:change", function(event, args) {
        for (var i = 0; i < args.results.length; i++) {
            if (args.results[i].hasOwnProperty("deleted") && args.results[i].deleted === true) {
                delete $scope.lists[args.results[i].id];
            } else {
                if (args.results[i].id.indexOf("_design") === -1) {
                    todoDatabase.getDocument(args.results[i].id).then(function(result) {
                        if (result.type === "list") {
                            $scope.lists[result._id] = result;
                        }
                    });
                }
            }
        }
    });


});








couchbaseApp.controller("TaskController", function($scope, $rootScope, $stateParams, $ionicPopup, $ionicHistory, $couchbase) {

    $scope.todoList = $stateParams.listId;

    $scope.tasks = {};

    $scope.insert = function() {
        $ionicPopup.prompt({
                title: 'Enter a new TODO task',
                inputType: 'text'
            })
            .then(function(result) {
                var obj = {
                    title: result,
                    type: "task",
                    list_id: $stateParams.listId,
                };
                todoDatabase.createDocument(obj).then(function(result) {
                    // The task was created successfully
                }, function(error) {
                    // There was an error creating the task
                });
            });
    };

    $scope.delete = function(task) {
        todoDatabase.deleteDocument(task._id, task._rev);
    }

    $scope.back = function() {
        $ionicHistory.goBack();
    }



    todoDatabase.queryView("_design/todo", "tasks", {
        "start_key": $stateParams.listId
    }).then(function(result) {
        for (var i = 0; i < result.rows.length; i++) {
            $scope.tasks[result.rows[i].id] = {
                "_id": result.rows[i].id,
                "title": result.rows[i].value.title,
                "list_id": result.rows[i].value.list_id,
                "_rev": result.rows[i].value.rev
            };
        }
    }, function(error) {
        // There was an error querying the view
    });



    $rootScope.$on("couchbase:change", function(event, args) {
        for (var i = 0; i < args.results.length; i++) {
            if (args.results[i].hasOwnProperty("deleted") && args.results[i].deleted === true) {
                delete $scope.tasks[args.results[i].id];
            } else {
                if (args.results[i].id.indexOf("_design") === -1) {
                    todoDatabase.getDocument(args.results[i].id).then(function(result) {
                        if (result.type === "task") {
                            $scope.tasks[result._id] = result;
                        }
                    });
                }
            }
        }
    });



});
