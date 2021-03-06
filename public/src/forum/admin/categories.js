"use strict";
/*global define, socket, app, bootbox, templates, ajaxify, RELATIVE_PATH*/

define(['uploader'], function(uploader) {
	var	Categories = {};

	Categories.init = function() {
		var modified_categories = {};

		function modified(el) {
			var cid = $(el).parents('li').attr('data-cid');
			if(cid) {
				modified_categories[cid] = modified_categories[cid] || {};
				modified_categories[cid][$(el).attr('data-name')] = $(el).val();
			}
		}

		function save() {
			if(Object.keys(modified_categories).length) {
				socket.emit('admin.categories.update', modified_categories, function(err, result) {
					if (err) {
						return app.alertError(err.message);
					}

					if (result && result.length) {
						app.alert({
							title: 'Updated Categories',
							message: 'Category IDs ' + result.join(', ') + ' was successfully updated.',
							type: 'success',
							timeout: 2000
						});
					}
				});
				modified_categories = {};
			}
			return false;
		}

		function select_icon(el) {
			var selected = el.attr('class').replace('fa-2x', '').replace('fa', '').replace(/\s+/g, '');
			$('#icons .selected').removeClass('selected');

			if (selected === '') {
				selected = 'fa-doesnt-exist';
			}
			if (selected) {
				$('#icons .fa-icons .fa.' + selected).parent().addClass('selected');
			}

			bootbox.confirm('<h2>Select an icon.</h2>' + $('#icons').html(), function(confirm) {
				if (confirm) {
					var iconClass = $('.bootbox .selected').children(':first').attr('class');

					el.attr('class', iconClass + ' fa-2x');

					// remove the 'fa ' from the class name, just need the icon name itself
					var categoryIconClass = iconClass.replace('fa ', '');
					if(categoryIconClass === 'fa-doesnt-exist') {
						categoryIconClass = '';
					}
					el.val(categoryIconClass);
					el.attr('value', categoryIconClass);

					modified(el);
				}
			});

			setTimeout(function() { //bootbox was rewritten for BS3 and I had to add this timeout for the previous code to work. TODO: to look into
				$('.bootbox .col-md-3').on('click', function() {
					$('.bootbox .selected').removeClass('selected');
					$(this).addClass('selected');
				});
			}, 500);
		}


		function update_blockclass(el) {
			el.parentNode.parentNode.className = 'entry-row ' + el.value;
		}

		function updateCategoryOrders() {
			var categories = $('.admin-categories #entry-container').children();
			for(var i = 0; i<categories.length; ++i) {
				var input = $(categories[i]).find('input[data-name="order"]');

				input.val(i+1).attr('data-value', i+1);
				modified(input);
			}
		}

		$('#entry-container').sortable({
			stop: function(event, ui) {
				updateCategoryOrders();
			},
			distance: 10
		});

		$('.blockclass, .admin-categories form select').each(function() {
			var $this = $(this);
			$this.val($this.attr('data-value'));
		});

		function showCreateCategoryModal() {
			$('#new-category-modal').modal();
		}

		function createNewCategory() {
			var category = {
				name: $('#inputName').val(),
				description: $('#inputDescription').val(),
				icon: $('#new-category-modal i').attr('value'),
				bgColor: '#0059b2',
				color: '#fff',
				order: $('.admin-categories #entry-container').children().length + 1
			};

			socket.emit('admin.categories.create', category, function(err, data) {
				if(err) {
					return app.alertError(err.message);
				}

				app.alert({
					alert_id: 'category_created',
					title: 'Created',
					message: 'Category successfully created!',
					type: 'success',
					timeout: 2000
				});

				ajaxify.loadTemplate('admin/categories', function(adminCategories) {
					var html = $(templates.parse(templates.getBlock(adminCategories, 'categories'), {categories: [data]}));

					html.find('[data-name="bgColor"], [data-name="color"]').each(enableColorPicker);

					$('#entry-container').append(html);
					$('#new-category-modal').modal('hide');
				});
			});
		}

		function enableColorPicker(idx, inputEl) {
			var	$inputEl = $(inputEl),
				previewEl = $inputEl.parents('[data-cid]').find('.preview-box');

			$inputEl.ColorPicker({
				color: $inputEl.val() || '#000',
				onChange: function(hsb, hex) {
					$inputEl.val('#' + hex);
					if ($inputEl.attr('data-name') === 'bgColor') {
						previewEl.css('background', '#' + hex);
					} else if ($inputEl.attr('data-name') === 'color') {
						previewEl.css('color', '#' + hex);
					}

					modified($inputEl[0]);
				}
			});
		}

		function setupEditTargets() {
			$('[data-edit-target]').on('click', function() {
				var $this = $(this),
					target = $($this.attr('data-edit-target'));

				$this.addClass('hide');
				target.removeClass('hide').on('blur', function() {
					$this.removeClass('hide').children('span').html(this.value);
					$(this).addClass('hide');
				}).val($this.children('span').html());

				target.focus();
			});
		}

		$(function() {
			var url = window.location.href,
				parts = url.split('/'),
				active = parts[parts.length - 1];

			$('.nav-pills li').removeClass('active');
			$('.nav-pills li a').each(function() {
				var $this = $(this);
				if ($this.attr('href').match(active)) {
					$this.parent().addClass('active');
					return false;
				}
			});


			$('#addNew').on('click', showCreateCategoryModal);
			$('#create-category-btn').on('click', createNewCategory);

			$('#entry-container').on('click', '.icon', function(ev) {
				select_icon($(this).find('i'));
			});

			$('#new-category-modal').on('click', '.icon', function(ev) {
				select_icon($(this).find('i'));
			});

			$('.admin-categories form input, .admin-categories form select').on('change', function(ev) {
				modified(ev.target);
			});

			$('.dropdown').on('click', '[data-disabled]', function(ev) {
				var btn = $(this),
					categoryRow = btn.parents('li'),
					cid = categoryRow.attr('data-cid'),
					disabled = btn.attr('data-disabled') === 'false' ? '1' : '0';

				categoryRow.remove();
				modified_categories[cid] = modified_categories[cid] || {};
				modified_categories[cid].disabled = disabled;

				save();
				return false;
			});

			// Colour Picker
			$('[data-name="bgColor"], [data-name="color"]').each(enableColorPicker);

			$('.admin-categories').on('click', '.save', save);

			// Permissions modal
			$('.admin-categories').on('click', '.permissions', function() {
				var	cid = $(this).parents('li[data-cid]').attr('data-cid');
				Categories.launchPermissionsModal(cid);
			});


			$('.admin-categories').on('click', '.upload-button', function() {
				var inputEl = $(this),
					cid = inputEl.parents('li[data-cid]').attr('data-cid');

				uploader.open(RELATIVE_PATH + '/admin/category/uploadpicture', {cid: cid}, 0, function(imageUrlOnServer) {
					inputEl.val(imageUrlOnServer);
					var previewBox = inputEl.parents('li[data-cid]').find('.preview-box');
					previewBox.css('background', 'url(' + imageUrlOnServer + '?' + new Date().getTime() + ')')
						.css('background-size', 'cover');
					modified(inputEl[0]);
				});
			});

			$('.admin-categories').on('click', '.delete-image', function() {
				var parent = $(this).parents('li[data-cid]'),
					inputEl = parent.find('.upload-button'),
					preview = parent.find('.preview-box'),
					bgColor = parent.find('.category_bgColor').val();

				inputEl.val('');
				modified(inputEl[0]);

				preview.css('background', bgColor);

				$(this).addClass('hide').hide();
			});

			$('#revertChanges').on('click', function() {
				ajaxify.refresh();
			});

			setupEditTargets();
		});
	};

	Categories.launchPermissionsModal = function(cid) {
		var	modal = $('#category-permissions-modal'),
			searchEl = modal.find('#permission-search'),
			resultsEl = modal.find('.search-results.users'),
			groupsResultsEl = modal.find('.search-results.groups'),
			searchDelay;

		// Clear the search field and results
		searchEl.val('');
		resultsEl.html('');

		searchEl.off().on('keyup', function() {
			var	searchEl = this,
				liEl;

			clearTimeout(searchDelay);

			searchDelay = setTimeout(function() {
				socket.emit('admin.categories.search', {
					username: searchEl.value,
					cid: cid
				}, function(err, results) {
					if(err) {
						return app.alertError(err.message);
					}

					templates.parse('partials/admin/categories/users', {
						users: results
					}, function(html) {
						resultsEl.html(html);
					});
				});
			}, 250);
		});

		Categories.refreshPrivilegeList(cid);

		resultsEl.off().on('click', '[data-priv]', function(e) {
			var	anchorEl = $(this),
				uid = anchorEl.parents('li[data-uid]').attr('data-uid'),
				privilege = anchorEl.attr('data-priv');
			e.preventDefault();
			e.stopPropagation();

			socket.emit('admin.categories.setPrivilege', {
				cid: cid,
				uid: uid,
				privilege: privilege,
				set: !anchorEl.hasClass('active')
			}, function(err, privileges) {
				anchorEl.toggleClass('active', privileges[privilege]);

				Categories.refreshPrivilegeList(cid);
			});
		});

		modal.off().on('click', '.members li > img', function() {
			searchEl.val($(this).attr('title'));
			searchEl.keyup();
		});

		// User Groups and privileges
		socket.emit('admin.categories.groupsList', cid, function(err, results) {
			if(err) {
				return app.alertError(err.message);
			}

			templates.parse('partials/admin/categories/groups', {
				groups: results
			}, function(html) {
				groupsResultsEl.html(html);
			});
		});

		groupsResultsEl.off().on('click', '[data-priv]', function(e) {
			var	anchorEl = $(this),
				name = anchorEl.parents('li[data-name]').attr('data-name'),
				privilege = anchorEl.attr('data-priv');
			e.preventDefault();
			e.stopPropagation();

			socket.emit('admin.categories.setGroupPrivilege', {
				cid: cid,
				name: name,
				privilege: privilege,
				set: !anchorEl.hasClass('active')
			}, function(err) {
				if (!err) {
					anchorEl.toggleClass('active');
				}
			});
		});

		modal.modal();
	};

	Categories.refreshPrivilegeList = function (cid) {
		var	modalEl = $('#category-permissions-modal'),
			memberList = $('.members');

		socket.emit('admin.categories.getPrivilegeSettings', cid, function(err, privilegeList) {
			var	membersLength = privilegeList.length,
				liEl, x, userObj;

			memberList.html('');
			if (membersLength > 0) {
				for(x = 0; x < membersLength; x++) {
					userObj = privilegeList[x];
					liEl = $('<li/>').attr('data-uid', userObj.uid).html('<img src="' + userObj.picture + '" title="' + userObj.username + '" />');
					memberList.append(liEl);
				}
			} else {
				liEl = $('<li/>').addClass('empty').html('None.');
				memberList.append(liEl);
			}
		});
	};

	return Categories;
});