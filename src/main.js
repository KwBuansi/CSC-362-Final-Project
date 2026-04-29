d3.csv('./data/cleaned_data.csv')
  .then(data => {
    console.log(data)

  })
  .catch(error => console.error(error));