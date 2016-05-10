/* global Morris */
window.addEventListener('load', init, false);
function init() {
    var viewModel = MainViewmodel();

    ko.applyBindings(viewModel);
}
